# Triagon ERP — web edition
FROM node:22-bookworm-slim
ENV NODE_ENV=production TZ=Asia/Kolkata DATA_DIR=/data PORT=8080 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-noto-core fonts-liberation tzdata ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# the Chromium build that matches playwright-core makes the PDFs (daily report, POs, orders, payslips)
RUN npx playwright-core install --with-deps chromium && rm -rf /var/lib/apt/lists/*
COPY shared ./shared
COPY server ./server
COPY client ./client
RUN node client/build.js && mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/server.js"]
