// Runtime module art footprints in logical units. Each view is a 512px transparent master.
export const MODULE_ART = {
  blade: { size: 30, spinAspect: 0.212, views: ['top', 'side', 'chase'] },
  drone: { size: 26, views: ['top', 'side', 'chase'] },
  interceptor: { size: 22, views: ['top', 'side', 'chase'], revisions: { chase: 2 } },
  mine: { size: 24, visible: 14, views: ['top', 'side', 'chase'] },
  saw: { size: 30, spinAspect: 0.271, views: ['top', 'side', 'chase'] },
};
