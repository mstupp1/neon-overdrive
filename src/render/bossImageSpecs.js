// Selected generated boss artwork. Each camera image is a transparent square
// composed for the existing logical sprite box; runtime rendering draws the
// full image into that box so dynamic combat parts keep their current anchors.
const views = (folder) => ({
  top: `${folder}/top-v1.png`,
  side: `${folder}/side-v1.png`,
  chase: `${folder}/chase-v1.png`,
});

export const BOSS_ART = {
  warden: {
    color: '#ff7a18',
    size: 230,
    sourceSize: 512,
    views: views('warden'),
    anchors: {
      top: {
        turrets: [[-27.1, -18.6], [27.1, -18.6]],
        engines: [[-16.5, -44.6], [16.5, -44.6]],
        rackLights: [[-63, 20.5], [63, 20.5]],
      },
      side: {
        turrets: [[-27.1, 11.9], [-26.8, -25.5]],
        engines: [[-9.4, -81.2], [15.2, -81.2]],
        rackLights: [],
      },
      chase: {
        turrets: [[-22.2, -15.7], [22.1, -15.7]],
        engines: [],
        rackLights: [],
      },
    },
  },
  hydra: {
    color: '#6dff4d',
    size: 250,
    sourceSize: 512,
    views: views('hydra'),
    parts: { pod: 'components/hydraPod-v1.png' },
  },
  omega: {
    color: '#3ff6ff',
    size: 120,
    sourceSize: 512,
    views: views('omega'),
    parts: { node: 'components/omegaNode-v1.png', shard: 'components/omegaShard-v1.png' },
  },
  eclipse: {
    color: '#c23bff',
    size: 210,
    sourceSize: 512,
    views: views('eclipse'),
    anchors: {
      top: { engines: [[-13.7, -68.2], [13.7, -68.2]] },
      side: { engines: [[-11.6, -70.5], [10.1, -70.5]] },
      chase: { engines: [] },
    },
  },
};

export default BOSS_ART;
