import { mall, unwrap } from '../api/client';
import type { Models } from '../domain';
import { commandHeaders, executeCommand } from './service';

/** Keep recipient, phone and street details out of the persisted command identity. */
async function identity(body: Models['AddressInput'] | Models['AddressUpdateRequest']): Promise<{ payloadSha256: string }> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)));
    return { payloadSha256: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('') };
}
export async function listOwnAddresses(): Promise<Models['AddressList']> {
    return unwrap(await mall.api.GET('/api/v1/addresses'));
}
export async function createOwnAddress(body: Models['AddressInput']): Promise<Models['Address']> {
    return executeCommand('POST', '/api/v1/addresses', await identity(body), async key => unwrap(await mall.api.POST('/api/v1/addresses', { body, params: { header: commandHeaders(key) } })));
}
export async function updateOwnAddress(addressId: string, body: Models['AddressUpdateRequest']): Promise<Models['Address']> {
    return executeCommand('PUT', `/api/v1/addresses/${addressId}`, await identity(body), async key => unwrap(await mall.api.PUT('/api/v1/addresses/{addressId}', { body, params: { path: { addressId }, header: commandHeaders(key) } })));
}
export async function deleteOwnAddress(addressId: string, version: number): Promise<Models['CommandResult']> {
    return executeCommand('DELETE', `/api/v1/addresses/${addressId}`, { version }, async key => unwrap(await mall.api.DELETE('/api/v1/addresses/{addressId}', { body: { version }, params: { path: { addressId }, header: commandHeaders(key) } })));
}
/** Setting a default is the existing full PUT contract, with the current address version. */
export async function makeOwnAddressDefault(address: Models['Address']): Promise<Models['Address']> {
    return updateOwnAddress(address.addressId, { recipientName: address.recipientName, phone: address.phone, province: address.province, city: address.city, district: address.district, detail: address.detail, isDefault: true, version: address.version });
}
