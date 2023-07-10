'use strict';

import './services/Server';

import WireGuard from './services/WireGuard';

WireGuard.getConfig()
  .catch(err => {
  // eslint-disable-next-line no-console
    console.error(err);

    // eslint-disable-next-line no-process-exit
    process.exit(1);
  });
