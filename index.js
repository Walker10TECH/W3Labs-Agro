import { registerRootComponent } from 'expo';

import W3LabsAgro from './W3LabsAgro';

// registerRootComponent calls W3LabsAgroRegistry.registerComponent('main', () => W3LabsAgro);
// It also ensures that whether you load the W3LabsAgro in Expo Go or in a native build,
// the environment is set up W3LabsAgroropriately
registerRootComponent(W3LabsAgro);
