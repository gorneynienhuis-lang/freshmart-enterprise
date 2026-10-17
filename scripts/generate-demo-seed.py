#!/usr/bin/env python3
"""Generate demo-only SQL after Flyway migrations. Does not connect to or reset any database."""
import argparse, base64, datetime as dt, hashlib, json, os, secrets
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
def quote(value):
    if value is None: return 'NULL'
    if isinstance(value, bool): return 'TRUE' if value else 'FALSE'
    if isinstance(value, int): return str(value)
    if '\\' in str(value) or '\x00' in str(value): raise ValueError('Unsupported SQL literal')
    return "'" + str(value).replace("'", "''") + "'"
def insert(table, columns, values):
    return f"INSERT INTO {table} ({','.join(columns)}) VALUES ({','.join(map(quote, values))});"
def password_hash(password):
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 600000, 32)
    return 'pbkdf2-sha256$600000$' + base64.b64encode(salt).decode() + '$' + base64.b64encode(key).decode()
def generate(args):
    password = os.environ.get('APP_DEMO_PASSWORD', '')
    if not 12 <= len(password) <= 128: raise SystemExit('Set APP_DEMO_PASSWORD to 12-128 characters; it will not be printed.')
    if args.output.exists(): raise SystemExit('Output already exists. Choose a new file; no overwrite/reset is performed.')
    parsed = urlparse(args.base_url)
    if parsed.scheme not in ('http','https') or not parsed.netloc or parsed.query or parsed.fragment or parsed.username or parsed.password or parsed.path not in ('', '/'):
        raise SystemExit('base-url must be an HTTP(S) origin, without query or fragment')
    base = dt.datetime.combine(dt.date.fromisoformat(args.base_date) if args.base_date else dt.datetime.now(dt.timezone.utc).date(), dt.time(), tzinfo=dt.timezone.utc)
    stamp = lambda d: d.strftime('%Y-%m-%d %H:%M:%S')
    catalog = json.loads((ROOT/'database/seed/catalog.json').read_text())
    sql = ['-- DEMO ONLY: synthetic accounts and regenerated stock. Insert-only; never resets existing data.',
           '-- Use an empty demo database after Flyway. Re-running against populated data must fail on unique IDs.', 'START TRANSACTION;']
    for i,role in enumerate(['MEMBER','OPERATOR','PICKER','COURIER','SERVICE','FINANCE','ADMIN'],1):
        uid=f'demo-{role.lower()}'
        sql.append(insert('fm_user',['user_id','phone','password_hash','display_name','status','must_change_password','version','created_at','updated_at'],[uid,f'1990000000{i}',password_hash(password),f'演示-{role}','ACTIVE',False,0,stamp(base),stamp(base)]))
        sql.append(insert('fm_user_role',['user_id','role_code'],[uid,role]))
    for c in catalog['categories']:
        sql.append(insert('fm_category',['category_id','code','name','short_name','image_url','sort_order','enabled'],[c['categoryId'],c['categoryId'],c['name'],c['shortName'],args.base_url.rstrip('/')+c['imagePath'],c['sortOrder'],True]))
    for p in catalog['products']:
        sql.append(insert('fm_product',['product_id','spu_code','category_id','name','description','origin','storage','image_url','status','version'],[p['productId'],p['productId'],p['categoryId'],p['name'],p['name']+'，课程演示商品资料，以演示配置为准。',p['origin'],p['storage'],args.base_url.rstrip('/')+p['imagePath'],'ON_SALE',0]))
    for i,s in enumerate(catalog['skus']):
        sid=s['skuId']
        sql.append(insert('fm_sku',['sku_id','sku_code','product_id','name','unit_label','base_unit','price_mode','price_unit_gram','price','member_price','image_url','status','version'],[sid,sid,s['productId'],s['name'],s['unitLabel'],s['baseUnit'],s['priceMode'],s['priceUnitGram'],s['price'],s['memberPrice'],args.base_url.rstrip('/')+s['imagePath'],'ACTIVE',0]))
        unit=1000 if s['baseUnit']=='GRAM' else 1
        # All availability comes from these batches; no duplicate SKU-level stock counter.
        scenarios=[('NORMAL',base+dt.timedelta(days=8),120*unit,0),('NEAR',base+dt.timedelta(days=2),12*unit,0),('EXPIRED',base-dt.timedelta(hours=1),3*unit,0)]
        if i==0: scenarios.append(('QUARANTINE',base+dt.timedelta(days=6),5*unit,5*unit))
        for tag,expires,on_hand,quarantined in scenarios:
            bid=f'{sid}-{tag}'
            sql.append(insert('fm_inventory_batch',['batch_id','sku_id','batch_no','warehouse_id','received_at','expires_at','lifecycle_status','on_hand','reserved','quarantined','version'],[bid,sid,bid,'warehouse-main',stamp(base-dt.timedelta(days=2)),stamp(expires),'QUARANTINED' if quarantined else 'NORMAL',on_hand,0,quarantined,0]))
    sql += ['COMMIT;','']
    args.output.parent.mkdir(parents=True, exist_ok=True)
    fd=os.open(args.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f: f.write('\n'.join(sql))
    print(f'Generated demo seed: {len(catalog["products"])} products, {len(catalog["skus"])} SKUs, 136 batches; no database was changed.')

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--environment',required=True,choices=['demo','test'])
    parser.add_argument('--output',required=True,type=Path)
    parser.add_argument('--base-date',help='UTC seed date YYYY-MM-DD (default current UTC date)')
    parser.add_argument('--base-url',default='http://localhost:8080')
    generate(parser.parse_args())
