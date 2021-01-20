ARG RUN

FROM node:12-alpine as builder

WORKDIR /app

COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json
COPY tsconfig.json /app/tsconfig.json

RUN apt-get update
RUN apt-get -y -qq install python-setuptools python-dev build-essential
RUN npm ci

COPY . /app

RUN npm run build

FROM node:12-alpine

WORKDIR /app

COPY --from=builder /app /app

ENTRYPOINT [ "./entrypoint.sh" ]
