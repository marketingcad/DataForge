import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    addTrailingSlash: false,
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  // Store io globally so server actions can emit events
  (global as Record<string, unknown>).__socketIO = io;

  io.on("connection", (socket) => {
    // Client sends their userId to join a personal room
    socket.on("join", (userId: string) => {
      if (typeof userId === "string" && userId.length > 0) {
        socket.join(`user:${userId}`);
      }
    });

    socket.on("disconnect", () => {
      // cleanup is automatic
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
