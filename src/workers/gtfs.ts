import sqlite3InitModule, { OpfsDatabase } from '@sqlite.org/sqlite-wasm';
import type { Agency, FeedInfo } from 'gtfs-types';
import * as Comlink from 'comlink';

export default class GtfsManager {
    private db: OpfsDatabase;

    static async writeFile(remoteUrl: string, errorStr: string) {
        const opfs = await navigator.storage.getDirectory();
        const dbHandle = await opfs.getFileHandle(remoteUrl.slice(remoteUrl.lastIndexOf('/') + 1), { create: true });
        const dbSyncAccess = await dbHandle.createSyncAccessHandle();
        const dbBuf = await fetch(remoteUrl)
            .then(res => res.arrayBuffer());
        dbSyncAccess.truncate(0);
        const bytesWritten = dbSyncAccess.write(dbBuf, { at: 0 });
        dbSyncAccess.close();
        if (bytesWritten !== dbBuf.byteLength)
            throw new Error(errorStr);
    }

    private constructor(db: OpfsDatabase) {
        this.db = db;
    }

    static async init() {
        const opfs = await navigator.storage.getDirectory();
        const hash = await opfs.getFileHandle('SC.hash', { create: true })
            .then(fh => fh.getFile())
            .then(file => file.text());
        const remoteHash = await fetch('https://ontime-feeds.brianhuyvo.com/hashes/SC.hash')
            .then(res => res.text());
        if (hash !== remoteHash) {
            console.log('Updating database');
            await this.writeFile('https://ontime-feeds.brianhuyvo.com/feeds/SC.db', 'Incomplete database retrieval');
            console.log('Updating geojson');
            await this.writeFile('https://ontime-feeds.brianhuyvo.com/geojson/SC/SC.geojson', 'Incomplete geojson retrieval');
            console.log('Updating hash');
            await this.writeFile('https://ontime-feeds.brianhuyvo.com/hashes/SC.hash', 'Incomplete hash retrieval');
        }
        
        console.log('Loading and initializing SQLite3 module...');
        const sqlite3 = await sqlite3InitModule();
        console.log('Running SQLite3 version', sqlite3.version.libVersion);
        
        if (!('opfs' in sqlite3)) throw new Error('OPFS not supported!')
        
        const db = new sqlite3.oo1.OpfsDb('/SC.db');

        return new this(db);
    }

    getFeedInfo() {
        const feedInfo = this.db.selectObject('SELECT * FROM feed_info;');
        return feedInfo ? (feedInfo as unknown as FeedInfo) : null;
    }

    getAgency() {
        const agency = this.db.selectObject('SELECT * FROM agency;');
        return agency ? (agency as unknown as Agency) : null;
    }
}

Comlink.expose(await GtfsManager.init());
postMessage(true);