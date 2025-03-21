import sqlite3InitModule, { OpfsDatabase } from '@sqlite.org/sqlite-wasm';
import type { Agency, FeedInfo, Route, Stop } from 'gtfs-types';
import * as Comlink from 'comlink';
import { FeatureCollection, MultiLineString, Point, Feature } from 'geojson';
import { AgencyCollection, AgencyList, StopWithRoutes } from '../types';
import { LngLatBounds } from 'maplibre-gl';

export default class GtfsManager {
    private db: OpfsDatabase;
    agencyCollection: AgencyCollection;

    static async writeFile(remoteUrl: string, errorStr: string) {
        const opfs = await navigator.storage.getDirectory();
        const dbHandle = await opfs.getFileHandle(remoteUrl.slice(remoteUrl.lastIndexOf('/') + 1), { create: true });
        if (dbHandle.createWritable !== undefined) {
            const dbStream = await dbHandle.createWritable();
            await fetch(remoteUrl).then(res => res.body?.pipeTo(dbStream));
        } else {
            const dbSyncAccess = await dbHandle.createSyncAccessHandle();
            const dbBuf = await fetch(remoteUrl)
                .then(res => res.arrayBuffer());
            dbSyncAccess.truncate(0);
            const bytesWritten = dbSyncAccess.write(dbBuf, { at: 0 });
            dbSyncAccess.close();
            if (bytesWritten !== dbBuf.byteLength)
                throw new Error(errorStr);
        }
    }

    private constructor(db: OpfsDatabase, agencyCollection: AgencyCollection) {
        this.db = db;
        this.agencyCollection = agencyCollection;
    }

    static async init() {
        const opfs = await navigator.storage.getDirectory();
        const hash = await opfs.getFileHandle('RG.hash', { create: true })
            .then(fh => fh.getFile())
            .then(file => file.text());
        const remoteHash = await fetch('https://ontime-feeds.brianhuyvo.com/hashes/RG.hash')
            .then(res => res.text());
        if (hash !== remoteHash) {
            console.log('Updating database');
            await this.writeFile('https://ontime-feeds.brianhuyvo.com/feeds/RG.db', 'Incomplete database retrieval');
            console.log('Updating geojson');
            await this.writeFile('https://ontime-feeds.brianhuyvo.com/geojson/RG/RG.geojson', 'Incomplete geojson retrieval');
            console.log('Updating hash');
            await this.writeFile('https://ontime-feeds.brianhuyvo.com/hashes/RG.hash', 'Incomplete hash retrieval');
        }
        
        const geojson: FeatureCollection<MultiLineString | Point, Route | Stop> = await navigator.storage.getDirectory()
            .then(opfs => opfs.getFileHandle('RG.geojson'))
            .then(fh => fh.getFile())
            .then(file => file.text())
            .then(text => JSON.parse(text));
        
        const featureCollection = geojson.features.reduce((obj: AgencyCollection, feature) => {
            if (feature.geometry.type === 'MultiLineString') {
                const routeFeature = feature as Feature<MultiLineString, Route>;
                obj.routes.features.push(routeFeature);
                const agencyId = routeFeature.properties.agency_id;
                if (!agencyId) return obj;
                if (!obj.routesByAgency[agencyId])
                    obj.routesByAgency[agencyId] = {
                        type: 'FeatureCollection',
                        features: []
                    }
                obj.routesByAgency[agencyId].features.push(routeFeature);
                
                if (!obj.boundsByAgency[agencyId])
                    obj.boundsByAgency[agencyId] = new LngLatBounds();
                routeFeature.geometry.coordinates.forEach(coords => coords.forEach(coord => {
                    const bounds = obj.bounds instanceof LngLatBounds ? 
                        obj.bounds :
                        new LngLatBounds(obj.bounds._sw, obj.bounds._ne);
                    bounds.extend([coord[0], coord[1]]);

                    const agencyBounds = obj.boundsByAgency[agencyId] instanceof LngLatBounds ? 
                        obj.boundsByAgency[agencyId] :
                        new LngLatBounds(obj.boundsByAgency[agencyId]._sw, obj.boundsByAgency[agencyId]._ne);
                    agencyBounds.extend([coord[0], coord[1]]);
                }));

                return obj;
            }
            
            const stopFeature = feature as Feature<Point, StopWithRoutes>;
            obj.stops.features.push(stopFeature);
            return obj;
        }, {
            routes: {
                type: 'FeatureCollection',
                features: []
            },
            routesByAgency: {},
            stops: {
                type: 'FeatureCollection',
                features: []
            },
            bounds: new LngLatBounds(),
            boundsByAgency: {},
        });
        
        
        console.log('Loading and initializing SQLite3 module...');
        const sqlite3 = await sqlite3InitModule();
        console.log('Running SQLite3 version', sqlite3.version.libVersion);
        
        if (!('opfs' in sqlite3)) throw new Error('OPFS not supported!')
        
        const db = new sqlite3.oo1.OpfsDb('/RG.db');

        return new this(db, featureCollection);
    }

    getFeedInfo() {
        const feedInfo = this.db.selectObject('SELECT * FROM feed_info;');
        return feedInfo ? (feedInfo as unknown as FeedInfo) : null;
    }

    getAgencies(): AgencyList {
        const agencies = this.db.selectObjects('SELECT * FROM agency ORDER BY agency_name;') as unknown as Agency[];
        return {
            list: agencies,
            map: agencies.reduce((map: Record<string, Agency>, agency) => {
                if (!agency.agency_id) return map;
                map[agency.agency_id] = agency;
                return map;
            }, {}),
        };
    }
}

Comlink.expose(await GtfsManager.init());
postMessage(true);