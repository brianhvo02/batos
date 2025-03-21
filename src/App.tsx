import { useEffect, useRef, useState } from 'react';
import './App.scss';
import type GtfsManager from './workers/gtfs';
import GtfsWorker from './workers/gtfs?worker';
import * as Comlink from 'comlink';
import { Layer, LineLayerSpecification, Map, Source } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, FeatureCollection, MultiLineString, Point } from 'geojson';
import { Box, Paper } from '@mui/material';

const layerStyle: LineLayerSpecification = {
    id: 'line',
    type: 'line',
    paint: {
        'line-color': {
            type: 'identity',
            property: 'route_color',
            default: '#007cbf'
        }
    },
    source: 'line-data'
};

interface AgencyCollection { 
    routes: FeatureCollection<MultiLineString>;
    stops: FeatureCollection<Point>;
}

const processGeojson = async function() {
    const geojson: FeatureCollection<MultiLineString | Point> = await navigator.storage.getDirectory()
        .then(opfs => opfs.getFileHandle('SC.geojson'))
        .then(fh => fh.getFile())
        .then(file => file.text())
        .then(text => JSON.parse(text));
        
    const featureCollection = geojson.features.reduce((obj: AgencyCollection, feature) => {
        if (feature.geometry.type === 'MultiLineString') 
            obj.routes.features.push(feature as Feature<MultiLineString>);
        else obj.stops.features.push(feature as Feature<Point>);

        return obj;
    }, {
        routes: {
            type: 'FeatureCollection',
            features: []
        },
        stops: {
            type: 'FeatureCollection',
            features: []
        },
    });

    return featureCollection;
}

const App = function() {
    const dbWorkerRef = useRef<Comlink.Remote<GtfsManager> | null>(undefined);
    const [agencyCollection, setAgencyCollection] = useState<AgencyCollection | null>(null);

    useEffect(() => {
        if (dbWorkerRef.current === undefined) {
            dbWorkerRef.current = null;
            const worker = new GtfsWorker();
            worker.onmessage = () => {
                dbWorkerRef.current = Comlink.wrap<GtfsManager>(worker);
                processGeojson().then(setAgencyCollection);
            };
        }
    }, []);

    if (!agencyCollection) return <></>;

    return (
    <Box position='relative' height='100%'>
        <Map
            initialViewState={{
                longitude: -121.893028,
                latitude: 37.335480,
                zoom: 10,
            }}
            style={{ height: '100%', position: 'absolute', zIndex: 0 }}
            mapStyle='https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        >
            <Source id="line-data" type="geojson" data={agencyCollection.routes ?? ''}>
                <Layer {...layerStyle} />
            </Source>
        </Map>
        <Paper elevation={24} sx={{ position: 'absolute', zIndex: 5, width: '25%', height: '80%', ml: '1rem', mt: '1rem' }}>
            
        </Paper>
    </Box>
    );
}

export default App;