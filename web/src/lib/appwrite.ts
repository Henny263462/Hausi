import { Account, Channel, Client, Realtime, Storage, TablesDB } from 'appwrite';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT } from './config';

export const client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT);

export const account = new Account(client);
export const tables = new TablesDB(client);
export const storage = new Storage(client);
export const realtime = new Realtime(client);
export { Channel };
