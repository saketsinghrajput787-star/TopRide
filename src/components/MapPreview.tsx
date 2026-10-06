import React from 'react';
import { MapRoutePreview } from './MapRoutePreview';

interface MapPreviewProps {
  origin?: string;
  destination?: string;
  originCoords?: { latitude: number; longitude: number };
  destCoords?: { latitude: number; longitude: number };
  routeGeometry?: any;
  height?: string;
  interactive?: boolean;
  className?: string;
  showStops?: boolean;
}

export const MapPreview: React.FC<MapPreviewProps> = (props) => {
  return <MapRoutePreview {...props} />;
};
