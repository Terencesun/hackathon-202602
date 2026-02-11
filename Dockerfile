FROM node:22.20.0-slim AS builder

WORKDIR /app

COPY . .

RUN npm install pnpm@10.29.2 -g

RUN pnpm run installpkg
RUN pnpm run build
RUN pnpm run postbuild

FROM node:22.20.0-slim AS runner

WORKDIR /app/build

RUN npm install pnpm@10.29.2 -g

COPY --from=builder /app/build ./

RUN pnpm install

EXPOSE 3000

CMD [ "pnpm", "run", "start" ]