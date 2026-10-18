// Selected generated miniboss views. Images are transparent 512px squares
// composed for the existing logical sprite box; component coordinates are in
// the same logical space as each body's center.
const views = (id, revisions = {}) => ({
  top: `${id}/top-v${revisions.top || 1}.png`,
  side: `${id}/side-v${revisions.side || 1}.png`,
  chase: `${id}/chase-v${revisions.chase || 1}.png`,
});

export const MINI_ART = {
  razorwing: {
    color: '#ffb02e', phaseColor: '#ff6a2b', size: 150, views: views('razorwing', { side: 2, chase: 2 }),
    anchors: {
      top: { engines: [[-6.8, -34.57], [6.87, -34.57]] },
      side: { engines: [[-4.82, -37.62], [3.06, -37.89]] },
      chase: { engines: [] },
    },
  },
  mauler: {
    color: '#ff4a3d', phaseColor: '#ff2e55', size: 170, views: views('mauler', { side: 2, chase: 2 }),
    anchors: {
      top: { engines: [[-8.48, -52.72], [8.15, -52.72]], muzzles: [[-45.09, 39.9], [45.81, 39.9]] },
      side: { engines: [[-7.73, -42.1], [7.33, -42.25]], muzzles: [[1.93, 27.97], [10.17, 20.25]] },
      chase: { engines: [], muzzles: [[-43.8, 19.21], [44.41, 19.21]] },
    },
  },
  broodmother: {
    color: '#ff4fd8', phaseColor: '#ff2e9a', size: 170, views: views('broodmother', { side: 2, chase: 2 }),
    anchors: {
      top: { sac: [-0.17, 24.09] },
      side: { sac: [14.96, -1.86] },
      chase: { sac: [-0.17, 13.7] },
    },
  },
  specter: {
    color: '#9b7bff', phaseColor: '#c23bff', size: 140, views: views('specter', { top: 2 }),
    parts: { scythe: 'components/specter-scythe-v1.png' },
  },
  arclight: {
    color: '#4fd6ff', phaseColor: '#9ffcff', size: 130, views: views('arclight', { side: 2 }),
    parts: { node: 'components/arclight-node-v1.png' },
  },
  citadel: {
    color: '#ffe14d', phaseColor: '#ff9e3d', size: 150, views: views('citadel'),
    parts: { turret: 'components/citadel-turret-v1.png' },
  },
};
export default MINI_ART;
