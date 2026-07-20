'use strict';

module.exports = (_jobRequest, context) => {
  context.closeWithFailure('DATA_NOT_READY');
};
