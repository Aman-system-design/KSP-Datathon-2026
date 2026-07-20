'use strict';

const RESPONSE = JSON.stringify({
  error: {
    code: 'DATA_NOT_READY',
    message: 'The intelligence service has not been composed yet.',
  },
});

module.exports = (_request, response) => {
  response.writeHead(503, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(RESPONSE);
};
