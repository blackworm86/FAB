// Copy the map scan and block labels the board needs into public/ (generated, not committed).
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('public', { recursive: true });
cpSync('../docs/maps/FAB The Bulge Game Map.jpg', 'public/map.jpg');
