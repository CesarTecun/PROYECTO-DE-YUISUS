FROM node:20-slim
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY views ./views
EXPOSE 3000
CMD ["npm","start"]
