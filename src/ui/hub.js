// The HANGAR and COLLECTION hubs open from the title menu or the campaign map; BACK from any of their top-level tabs
// returns there. Whoever opens a hub sets hub.exit (main.js).
export const hub = { exit: null };
export const hubExit = () => hub.exit && hub.exit();
