FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

WORKDIR /app
COPY package.json server.js index.html vuur.jpg ./

RUN mkdir -p /data && chown node:node /data
USER node

VOLUME /data
EXPOSE 3000

CMD ["node", "server.js"]
