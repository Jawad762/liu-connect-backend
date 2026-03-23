ARG NODE_VERSION=22.17.0
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV production

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /usr/src/app/dist ./dist

EXPOSE 3000
USER node
CMD ["npm", "run", "start"]