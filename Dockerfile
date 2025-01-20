FROM node:alpine3.21
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY ./src ./src
COPY ./env ./env
COPY ./public ./public
CMD [ "npm", "start" ]