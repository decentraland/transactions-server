import morgan = require('morgan')

export function withLogger() {
  return morgan(
    ':remote-addr :remote-user :method :url HTTP/:http-version :status :res[content-length] - :response-time ms'
  )
}
