import type { FeatureCollection, MultiLineString, Point } from 'geojson';
import type { Agency, Route, Stop } from 'gtfs-types';
import type { LngLatBounds } from 'maplibre-gl';

export interface StopWithRoutes extends Stop {
    routes: Route[];
}

export interface RawLngLatBounds {
    _ne: RawLngLat;
    _sw: RawLngLat;
}

export interface RawLngLat {
    lng: number;
    lat: number;
}

export interface AgencyCollection { 
    routes: FeatureCollection<MultiLineString, Route>;
    routesByAgency: Record<string, FeatureCollection<MultiLineString, Route>>;
    stops: FeatureCollection<Point, StopWithRoutes>;
    bounds: LngLatBounds | RawLngLatBounds;
    boundsByAgency: Record<string, LngLatBounds | RawLngLatBounds>;
}

export interface AgencyList {
    list: Agency[];
    map: Record<string, Agency>;
}