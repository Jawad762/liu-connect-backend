### Building and running your application

This setup starts two containers from the same image:
- `api` runs the HTTP server
- `worker` runs the BullMQ worker

Both services load runtime values from `.env` via `env_file`.

When you're ready, start your application by running:
`docker compose up --build`.

The API will be available at http://localhost:3000.

### External services

Redis and Postgres are expected to be external to this compose file.
Set `REDIS_URL` and `DATABASE_URL` in `.env` to reachable endpoints from inside containers.

### Deploying your application to the cloud

First, build your image, e.g.: `docker build -t myapp .`.
If your cloud uses a different CPU architecture than your development
machine (e.g., you are on a Mac M1 and your cloud provider is amd64),
you'll want to build the image for that platform, e.g.:
`docker build --platform=linux/amd64 -t myapp .`.

Then, push it to your registry, e.g. `docker push myregistry.com/myapp`.

Consult Docker's [getting started](https://docs.docker.com/go/get-started-sharing/)
docs for more detail on building and pushing.

### References
* [Docker's Node.js guide](https://docs.docker.com/language/nodejs/)