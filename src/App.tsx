import { useEffect, useRef, useState } from 'react';
import './App.scss';
import type GtfsManager from './workers/gtfs';
import GtfsWorker from './workers/gtfs?worker';
import * as Comlink from 'comlink';
import { Layer, LineLayerSpecification, Map, Source, useMap } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box, Button, List, ListItemButton, ListItemIcon, ListItemText, Paper, Stack, Typography } from '@mui/material';
import { AgencyCollection, AgencyList } from './types';
import { LngLatBounds } from 'maplibre-gl';

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

const App = function() {
    const dbWorkerRef = useRef<Comlink.Remote<GtfsManager> | null>(undefined);
    const [agencyCollection, setAgencyCollection] = useState<AgencyCollection>();
    const [agencies, setAgencies] = useState<AgencyList>();
    const [selectedAgency, setSelectedAgency] = useState('');
    const map = useMap();

    useEffect(() => {
        if (dbWorkerRef.current === undefined) {
            dbWorkerRef.current = null;
            const worker = new GtfsWorker();
            worker.onmessage = () => {
                dbWorkerRef.current = Comlink.wrap<GtfsManager>(worker);
                dbWorkerRef.current.agencyCollection.then(setAgencyCollection);
                dbWorkerRef.current.getAgencies().then(setAgencies);
                worker.onmessage = null;
            };
        }
    }, []);

    useEffect(() => {
        if (!map.default || !agencyCollection) return;

        const bounds = selectedAgency ? 
            agencyCollection.boundsByAgency[selectedAgency] : 
            agencyCollection.bounds;
        map.default.fitBounds(
            bounds instanceof LngLatBounds ?
                bounds : 
                new LngLatBounds(bounds._sw, bounds._ne),
            { padding: { left: 525, right: 25, top: 25, bottom: 25 } });
    }, [map, selectedAgency, agencyCollection]);
    
    if (!agencyCollection || !agencies) return <></>;

    return (
    <Box position='relative' height='100%'>
        <Map
            initialViewState={{
                longitude: -122.37,
                latitude: 37.81,
                zoom: 8.5,
            }}
            style={{ height: '100%', position: 'absolute', zIndex: 0 }}
            mapStyle='https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        >
            <Source id="line-data" type="geojson" data={selectedAgency ? agencyCollection.routesByAgency[selectedAgency] : agencyCollection.routes}>
                <Layer {...layerStyle} />
            </Source>
        </Map>
        <Paper elevation={24} sx={{ 
            position: 'absolute', zIndex: 5, width: '32rem', height: '80%', ml: '1rem', mt: '1rem',
        }}>
            <Stack sx={{ height: '100%' }}>
                <Typography variant='h6' sx={{ p: '1rem' }}>
                    Select Agency
                </Typography>
                <List sx={{ width: '100%', overflow: 'auto' }}>
                    { agencies.list.map((agency) => (
                    <ListItemButton key={agency.agency_id} selected={selectedAgency === agency.agency_id} onClick={() => {
                        setSelectedAgency(prev => prev === agency.agency_id ? '' : (agency.agency_id ?? ''));
                    }}>
                        <ListItemIcon>
                            <ListItemText primary={agency.agency_id} />
                        </ListItemIcon>
                        <ListItemText primary={agency.agency_name} secondary={agency.agency_url} />
                    </ListItemButton>
                    )) }
                </List>
                <Button color='primary' sx={{ p: '1rem' }} disabled={!selectedAgency}>
                    Select
                </Button>
            </Stack>
            
        </Paper>
    </Box>
    );
}

export default App;