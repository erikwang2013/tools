FROM node:18-alpine AS build

WORKDIR /app

# The build image does not need the Cypress binary or git hooks.
ENV CYPRESS_INSTALL_BINARY=0
ENV HUSKY_SKIP_INSTALL=1

COPY package*.json .npmrc ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run generate

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
