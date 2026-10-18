#!/usr/bin/env python3
"""Live MySQL/API concurrency probe. Creates isolated synthetic fixtures; never resets demo data.

Run only after the backend, Flyway migrations and seed are ready:
  python3 docs/evidence/demo-runtime/commerce-probe.py --confirm-demo
Passwords/tokens/signing secrets stay in memory and are excluded from evidence.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import hashlib
import hmac
import http.cookiejar
import importlib.util
import json
import os
from pathlib import Path
import secrets
import threading
import time
import urllib.error
import urllib.request
import uuid
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
BASE = 'http://127.0.0.1:8080/api/v1'
ORIGIN = 'http://localhost:5173'
FIXTURE_IMAGE = 'http://127.0.0.1:8080/catalog/S001.jpg'
N = 6
RUN = 'probe-' + uuid.uuid4().hex[:12]
ACTIVE_SCENARIO = None
spec = importlib.util.spec_from_file_location('demo_runtime', ROOT / 'scripts/demo-runtime.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def sql(query):
    return runtime.mysql(query)


def count(query):
    return int(sql(query))


class Client:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.token = None
        self.user_id = None
        self.address = None

    def request(self, method, path, body=None, key=None, extra=None, raw=None, cookie_auth=False):
        headers = {'Origin': ORIGIN, 'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = 'Bearer ' + self.token
        if key:
            headers['Idempotency-Key'] = key
        if extra:
            headers.update(extra)
        payload = raw.encode() if raw is not None else (json.dumps(body, ensure_ascii=False, separators=(',', ':')).encode() if body is not None else None)
        handlers = [urllib.request.ProxyHandler({})]
        if cookie_auth:
            handlers.append(urllib.request.HTTPCookieProcessor(self.cookies))
        opener = urllib.request.build_opener(*handlers)
        request = urllib.request.Request(BASE + path, data=payload, headers=headers, method=method)
        started = time.monotonic()
        try:
            response = opener.open(request, timeout=45)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            text = response.read().decode()
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                data = {'message': 'Non-JSON HTTP response'}
            return {'status': response.status, 'body': data, 'elapsedMs': round((time.monotonic() - started) * 1000, 1)}

    def ok(self, method, path, body=None, key=None):
        result = self.request(method, path, body, key or str(uuid.uuid4()))
        if result['status'] not in (200, 201):
            raise AssertionError(f'{method} {path}: HTTP {result["status"]}, code {result["body"].get("code")}, trace {result["body"].get("traceId")}')
        return result['body']['data']

    def register(self, index, password):
        csrf = self.request('GET', '/auth/csrf', cookie_auth=True)
        assert csrf['status'] == 200
        phone = '139' + str(secrets.randbelow(100_000_000)).zfill(8)
        result = self.request('POST', '/auth/register', {'phone': phone, 'password': password, 'displayName': RUN + '-' + str(index)}, extra={'X-CSRF-Token': csrf['body']['data']['csrfToken']}, cookie_auth=True)
        assert result['status'] == 201, f'registration HTTP {result["status"]}'
        session = result['body']['data']
        self.token = session['accessToken']
        self.user_id = session['user']['userId']
        self.address = self.ok('POST', '/addresses', {'recipientName': '课程并发测试', 'phone': phone, 'province': '上海市', 'city': '上海市', 'district': '松江区', 'detail': '东华大学课程并发夹具，不实际配送', 'isDefault': True})['addressId']

    def quote(self, fixture):
        return self.ok('POST', '/orders/quote', {'items': [{'skuId': fixture['sku'], 'quantity': 1}], 'addressId': self.address, 'slotId': fixture['slot'], 'couponId': None})


def compact(result):
    body = result['body']
    data = body.get('data') or {}
    return {'http': result['status'], 'code': body.get('code'), 'errorKey': data.get('errorKey') if isinstance(data, dict) else None, 'traceId': body.get('traceId'), 'elapsedMs': result['elapsedMs']}


def concurrent(functions):
    barrier = threading.Barrier(len(functions))
    def worker(function):
        barrier.wait(timeout=20)
        return function()
    with ThreadPoolExecutor(max_workers=len(functions)) as executor:
        return list(executor.map(worker, functions))


def fixture(index, stock, capacity, distinct_slots=False):
    prefix = f'{RUN}-{index}'
    category, product, sku, batch, slot = [prefix + '-' + suffix for suffix in ['cat', 'spu', 'sku', 'batch', 'slot']]
    tomorrow = dt.datetime.now(ZoneInfo('Asia/Shanghai')).date() + dt.timedelta(days=1)
    # Separate from scheduled 09–12 / 14–17 / 18–21 slots and other probe runs.
    start = dt.datetime.combine(tomorrow, dt.time(10 + index, 17, secrets.randbelow(50) + 1), ZoneInfo('Asia/Shanghai'))
    end = start + dt.timedelta(minutes=11)
    stamp = lambda value: literal(value.astimezone(dt.timezone.utc).strftime('%Y-%m-%d %H:%M:%S'))
    sql(f"""START TRANSACTION;
INSERT INTO fm_category(category_id,code,name,short_name,image_url,sort_order,enabled) VALUES({literal(category)},{literal(category)},'课程并发夹具','测试',{literal(FIXTURE_IMAGE)},999,TRUE);
INSERT INTO fm_product(product_id,spu_code,category_id,name,description,origin,storage,image_url,status,version) VALUES({literal(product)},{literal(product)},{literal(category)},'课程并发测试商品','独立测试夹具，测试后下架','合成数据','AMBIENT',{literal(FIXTURE_IMAGE)},'ON_SALE',0);
INSERT INTO fm_sku(sku_id,sku_code,product_id,name,unit_label,base_unit,price_mode,price_unit_gram,price,member_price,image_url,status,version) VALUES({literal(sku)},{literal(sku)},{literal(product)},'并发测试件','件','PIECE','BY_PIECE',NULL,100,100,{literal(FIXTURE_IMAGE)},'ACTIVE',0);
INSERT INTO fm_inventory_batch(batch_id,sku_id,batch_no,warehouse_id,received_at,expires_at,lifecycle_status,on_hand,reserved,quarantined,version) VALUES({literal(batch)},{literal(sku)},{literal(batch)},'warehouse-main',UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 8 DAY),'NORMAL',{stock},0,0,0);
COMMIT;""")
    slots = [slot + '-' + str(peer) for peer in range(N)] if distinct_slots else [slot]
    for peer, slot_id in enumerate(slots):
        peer_start = start + dt.timedelta(minutes=peer * 12)
        peer_end = end + dt.timedelta(minutes=peer * 12)
        sql(f"INSERT INTO fm_delivery_slot(slot_id,slot_date,label,start_at,end_at,cutoff_at,capacity,used,enabled,version) VALUES({literal(slot_id)},{literal(tomorrow)},'课程并发夹具',{stamp(peer_start)},{stamp(peer_end)},{stamp(peer_start-dt.timedelta(minutes=30))},{capacity},0,TRUE,0);")
    return {'category': category, 'product': product, 'sku': sku, 'batch': batch, 'slot': slots[0], 'slots': slots, 'initialStock': stock, 'capacity': capacity}


def slot_set(fixture):
    return ','.join(literal(slot_id) for slot_id in fixture['slots'])


def balances(fixture):
    row = sql(f'SELECT on_hand,reserved,quarantined FROM fm_inventory_batch WHERE batch_id={literal(fixture["batch"])};').split('\t')
    slot = sql(f'SELECT SUM(capacity),SUM(used) FROM fm_delivery_slot WHERE slot_id IN ({slot_set(fixture)});').split('\t')
    return {'onHand': int(row[0]), 'reserved': int(row[1]), 'quarantined': int(row[2]), 'capacity': int(slot[0]), 'used': int(slot[1]), 'orders': count(f'SELECT COUNT(*) FROM fm_order WHERE slot_id IN ({slot_set(fixture)});')}


def create_body(quote):
    return {'quoteId': quote['quoteId'], 'quoteToken': quote['quoteToken'], 'buyerNote': '并发测试夹具，不实际配送'}


def cancel(client, order_id):
    current = client.ok('GET', '/orders/' + order_id)
    if current['status'] in ('PENDING_PAY', 'PAID', 'PICKING', 'READY_TO_SHIP'):
        client.ok('POST', f'/orders/{order_id}/cancel', {'reason': '课程并发探针完成，释放独立夹具资源', 'version': current['version']})


def contest(clients, fixture, label):
    global ACTIVE_SCENARIO
    quotes = [client.quote({**fixture, 'slot': fixture['slots'][index % len(fixture['slots'])]}) for index, client in enumerate(clients)]
    results = concurrent([lambda c=client, q=quote: c.request('POST', '/orders', create_body(q), str(uuid.uuid4())) for client, quote in zip(clients, quotes)])
    winners = [(client, result['body']['data']['orderId']) for client, result in zip(clients, results) if result['status'] == 201]
    snapshot = balances(fixture)
    report = {'scenario': label, 'simultaneousRequests': len(results), 'distinctDeliverySlots': len(fixture['slots']), 'responses': [compact(r) for r in results], 'beforeCancel': snapshot}
    ACTIVE_SCENARIO = report
    try:
        assert len(winners) == 1, f'{label}: expected one successful order, got {len(winners)}'
        rejected_status, rejected_code = 422, (1202 if fixture['capacity'] == 1 else 1201)
        assert all(r['status'] == 201 or (r['status'] == rejected_status and r['body'].get('code') == rejected_code) for r in results), f'{label}: unexpected rejection status or code (including possible 500)'
        assert snapshot['orders'] == 1 and snapshot['reserved'] == 1 and snapshot['used'] == 1, f'{label}: resource conservation failed'
        assert snapshot['onHand'] == fixture['initialStock'] and snapshot['quarantined'] == 0
        assert snapshot['reserved'] <= snapshot['onHand'] and snapshot['used'] <= snapshot['capacity']
    finally:
        for client, order_id in winners:
            cancel(client, order_id)
        report['afterCancel'] = balances(fixture)
    assert report['afterCancel']['reserved'] == 0 and report['afterCancel']['used'] == 0
    report['passed'] = True
    return report


def signed_headers(raw, signing_secret, nonce=None):
    timestamp, nonce = str(int(time.time())), nonce or str(uuid.uuid4())
    digest = hmac.new(signing_secret.encode(), (timestamp + '\n' + nonce + '\n' + raw).encode(), hashlib.sha256).hexdigest()
    return {'X-Sandbox-Timestamp': timestamp, 'X-Sandbox-Nonce': nonce, 'X-Sandbox-Signature': digest}


def idempotency_and_boundary(clients, fixture, signing_secret):
    global ACTIVE_SCENARIO
    client, other = clients[:2]
    quote = client.quote(fixture)
    body, key = create_body(quote), str(uuid.uuid4())
    responses = concurrent([lambda: client.request('POST', '/orders', body, key) for _ in range(N)])
    order_ids = {r['body'].get('data', {}).get('orderId') for r in responses if r['status'] == 201}
    report = {'scenario': 'same-key order + authorization + signed payment replay', 'responses': [compact(r) for r in responses]}
    ACTIVE_SCENARIO = report
    assert all(r['status'] == 201 for r in responses), 'Identical simultaneous requests must replay one creation result'
    assert len(order_ids) == 1 and None not in order_ids
    order_id = next(iter(order_ids))
    try:
        report['singleReservation'] = balances(fixture)
        assert report['singleReservation']['orders'] == 1 and report['singleReservation']['reserved'] == 1 and report['singleReservation']['used'] == 1
        changed = client.request('POST', '/orders', {**body, 'buyerNote': '不同请求体'}, key)
        foreign = other.request('GET', '/orders/' + order_id)
        anonymous = Client().request('GET', '/orders/' + order_id)
        forbidden = client.request('GET', '/admin/pick-tasks')
        trusted_price = client.request('POST', '/orders', {**body, 'payableAmount': 1}, str(uuid.uuid4()))
        checks = {'sameKeyDifferentBody': (changed, 409), 'otherMemberResource': (foreign, 404), 'unauthenticatedResource': (anonymous, 401), 'memberPickingRoute': (forbidden, 403), 'clientSubmittedPrice': (trusted_price, 400)}
        report['boundaries'] = {name: compact(result) for name, (result, _) in checks.items()}
        for name, (result, status) in checks.items():
            assert result['status'] == status, f'{name}: expected {status}, got {result["status"]}'
        assert changed['body'].get('code') == 1008
        payment = client.ok('POST', '/payments/prepay', {'orderId': order_id, 'purpose': 'ORDER', 'adjustmentId': None})
        payment_id = payment['paymentId']
        event = {'eventId': RUN + '-event', 'paymentId': payment_id, 'channelTradeNo': RUN + '-trade', 'status': 'SUCCESS', 'amount': payment['amount'], 'currency': 'CNY', 'occurredAt': dt.datetime.now(dt.timezone.utc).isoformat()}
        raw = json.dumps(event, separators=(',', ':'))
        callback_client = Client()
        forged = callback_client.request('POST', '/payments/sandbox/callback', raw=raw)
        tampered_raw = json.dumps({**event, 'amount': event['amount'] + 1}, separators=(',', ':'))
        tampered = callback_client.request('POST', '/payments/sandbox/callback', raw=tampered_raw, extra=signed_headers(tampered_raw, signing_secret))
        report['boundaries']['unsignedCallback'] = compact(forged)
        report['boundaries']['signedWrongAmount'] = compact(tampered)
        assert forged['status'] == 401 and tampered['status'] == 422
        assert tampered['body'].get('code') == 1302
        assert count(f'SELECT paid_amount FROM fm_order WHERE order_id={literal(order_id)};') == 0
        headers = signed_headers(raw, signing_secret)
        callbacks = concurrent([lambda: callback_client.request('POST', '/payments/sandbox/callback', raw=raw, extra=headers) for _ in range(N)])
        assert all(r['status'] == 200 for r in callbacks), 'Duplicate signed events should replay successfully'
        assert sum(r['body']['data']['duplicate'] is False for r in callbacks) == 1
        assert sum(r['body']['data']['duplicate'] is True for r in callbacks) == N - 1
        assert all(r['body']['data']['accepted'] is True for r in callbacks)
        paid_amount = count(f'SELECT paid_amount FROM fm_order WHERE order_id={literal(order_id)};')
        event_count = count(f'SELECT COUNT(*) FROM fm_payment_event WHERE payment_id={literal(payment_id)};')
        assert paid_amount == payment['amount'] and event_count == 1
        report['signedCallbackReplay'] = {'responses': [compact(r) for r in callbacks], 'paidAmount': paid_amount, 'paymentEventRows': event_count, 'expectedAmount': payment['amount']}
        conflicting_event = callback_client.request('POST', '/payments/sandbox/callback', raw=tampered_raw, extra=signed_headers(tampered_raw, signing_secret))
        assert conflicting_event['status'] == 422 and conflicting_event['body'].get('code') == 1302
        report['boundaries']['sameEventDifferentBody'] = compact(conflicting_event)
        assert count(f'SELECT paid_amount FROM fm_order WHERE order_id={literal(order_id)};') == paid_amount
    finally:
        cancel(client, order_id)
        report['afterCancel'] = balances(fixture)
    assert report['afterCancel']['reserved'] == 0 and report['afterCancel']['used'] == 0
    deadline = time.monotonic() + 15
    refunded = 0
    while time.monotonic() < deadline:
        refunded = count(f'SELECT refunded_amount FROM fm_order WHERE order_id={literal(order_id)};')
        if refunded == paid_amount:
            break
        time.sleep(0.5)
    successful_refunds = count(f"SELECT COUNT(*) FROM fm_refund WHERE order_id={literal(order_id)} AND status='SUCCESS';")
    report['refundAfterCancel'] = {'refundedAmount': refunded, 'paidAmount': paid_amount, 'successfulRefundRows': successful_refunds}
    assert refunded == paid_amount and successful_refunds == 1, 'Cancel refund did not complete exactly once'
    report['passed'] = True
    return report


def retire(fixtures):
    # Only our new fixtures are changed. Preserve audit, canceled orders and financial rows.
    for index, item in enumerate(fixtures):
        past = dt.datetime(2020, 1, 1, tzinfo=dt.timezone.utc) + dt.timedelta(seconds=int(RUN[6:12], 16) + index * 900)
        end = past + dt.timedelta(minutes=11)
        stamp = lambda value: literal(value.strftime('%Y-%m-%d %H:%M:%S'))
        sql(f"START TRANSACTION; UPDATE fm_product SET status='OFF_SALE',version=version+1 WHERE product_id={literal(item['product'])}; UPDATE fm_sku SET status='DISABLED',version=version+1 WHERE sku_id={literal(item['sku'])}; UPDATE fm_category SET enabled=FALSE WHERE category_id={literal(item['category'])}; COMMIT;")
        for peer, slot_id in enumerate(item['slots']):
            peer_start, peer_end = past + dt.timedelta(minutes=peer), end + dt.timedelta(minutes=peer)
            sql(f"UPDATE fm_delivery_slot SET enabled=FALSE,slot_date={literal(peer_start.date())},start_at={stamp(peer_start)},end_at={stamp(peer_end)},cutoff_at={stamp(peer_start-dt.timedelta(minutes=30))},version=version+1 WHERE slot_id={literal(slot_id)};")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--confirm-demo', action='store_true', required=True)
    parser.parse_args()
    os.umask(0o077)
    assert runtime.owned('mysql'), 'Only the project-owned isolated MySQL is supported'
    assert sql('SELECT DATABASE();') == 'fresh_mall_demo'
    assert sql('SELECT @@version;').startswith('8.4.')
    assert runtime.backend_healthy(), 'Backend health must be UP'
    assert count("SELECT COUNT(*) FROM flyway_schema_history WHERE version IN ('001','002','003','004','005','1','2','3','4','5') AND success=1;") == 5, 'Flyway V001-V005 must be successful'
    values = runtime.load_env()
    report = {'runId': RUN, 'startedAt': dt.datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(), 'database': 'MySQL ' + sql('SELECT @@version;'), 'api': BASE, 'simultaneousClients': N, 'fixturePolicy': 'new namespaced synthetic fixtures only; orders canceled, products retired, audit preserved', 'tests': [], 'passed': False}
    fixtures, clients = [], []
    try:
        clients = [Client() for _ in range(N)]
        for index, client in enumerate(clients):
            client.register(index, values['APP_DEMO_PASSWORD'])
        fixtures.append(fixture(0, stock=1, capacity=30, distinct_slots=True))
        report['tests'].append(contest(clients, fixtures[-1], 'last inventory unit, six distinct users'))
        fixtures.append(fixture(1, stock=50, capacity=1))
        report['tests'].append(contest(clients, fixtures[-1], 'last delivery slot, six distinct users'))
        fixtures.append(fixture(2, stock=50, capacity=30))
        report['tests'].append(idempotency_and_boundary(clients, fixtures[-1], values['SANDBOX_SECRET']))
        report['passed'] = True
    except Exception as error:
        report['failureType'] = type(error).__name__
        report['failure'] = str(error)
        if ACTIVE_SCENARIO is not None and not any(item is ACTIVE_SCENARIO for item in report['tests']):
            report['failedScenarioEvidence'] = ACTIVE_SCENARIO
    finally:
        try:
            clients_by_id = {client.user_id: client for client in clients if client.user_id}
            for item in fixtures:
                outstanding = sql(f"SELECT order_id,user_id FROM fm_order WHERE slot_id IN ({slot_set(item)}) AND status IN ('PENDING_PAY','PAID','PICKING','READY_TO_SHIP');")
                for row in outstanding.splitlines():
                    order_id, user_id = row.split('\t')
                    cancel(clients_by_id[user_id], order_id)
            retire(fixtures)
            report['fixturesRetired'] = True
        except Exception as error:
            report['fixturesRetired'] = False
            report['cleanupFailureType'] = type(error).__name__
        report['finishedAt'] = dt.datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()
        path = OUT / f'{RUN}-results.json'
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'passed': report['passed'], 'completedScenarios': len(report['tests']), 'evidence': str(path)}, ensure_ascii=False))
    return 0 if report['passed'] and report.get('fixturesRetired') else 1


if __name__ == '__main__':
    raise SystemExit(main())
