"use strict";

import path from "path";

import express from "express";
import expressSession from "express-session";
import debugModule from "debug";
const debug = debugModule("Server");

import Util from "./Util";
import ServerError from "./ServerError";
import WireGuard from "../services/WireGuard";

import { PORT, RELEASE, PASSWORD } from "../config";

export default class Server {
  app: Express.Application;

  constructor() {
    // Express
    this.app = express()
      .disable("etag")
      .use("/", express.static(path.join(__dirname, "..", "www")))
      .use(express.json())
      .use(
        expressSession({
          secret: String(Math.random()),
          resave: true,
          saveUninitialized: true,
        })
      )
      .get(
        "/api/release",
        Util.promisify(async () => {
          return RELEASE;
        })
      )

      // Authentication
      .get(
        "/api/session",
        Util.promisify(async (req: express.Request) => {
          const requiresPassword = !!process.env.PASSWORD;
          const authenticated = requiresPassword
            ? !!(req.session && (req.session as any)["authenticated"])
            : true;

          return {
            requiresPassword,
            authenticated,
          };
        })
      )
      .post(
        "/api/session",
        Util.promisify(async (req: express.Request) => {
          const { password } = req.body;

          if (typeof password !== "string") {
            throw new ServerError("Missing: Password", 401);
          }

          if (password !== PASSWORD) {
            throw new ServerError("Incorrect Password", 401);
          }

          (req.session as any)["authenticated"] = true;
          req.session.save();

          debug(`New Session: ${req.session.id}`);
        })
      )

      // WireGuard
      .use((req, res, next) => {
        if (!PASSWORD) {
          return next();
        }

        if (req.session && (req.session as any)["authenticated"]) {
          return next();
        }

        return res.status(401).json({
          error: "Not Logged In",
        });
      })
      .delete(
        "/api/session",
        Util.promisify(async (req: express.Request) => {
          const sessionId = req.session.id;

          req.session.destroy((err) => {
            debug(`Deleted Session: ${sessionId}`);
          });
        })
      )
      .get(
        "/api/wireguard/client",
        Util.promisify(async (req: express.Request) => {
          return WireGuard.getClients();
        })
      )
      .get(
        "/api/wireguard/client/:clientId/qrcode.svg",
        Util.promisify(async (req: express.Request, res: express.Response) => {
          const { clientId } = req.params;
          const svg = await WireGuard.getClientQRCodeSVG({ clientId });
          res.header("Content-Type", "image/svg+xml");
          res.send(svg);
        })
      )
      .get(
        "/api/wireguard/client/:clientId/configuration",
        Util.promisify(async (req: express.Request, res: express.Response) => {
          const { clientId } = req.params;
          const client = await WireGuard.getClient({ clientId });
          const config = await WireGuard.getClientConfiguration({ clientId });
          const configName = client.name
            .replace(/[^a-zA-Z0-9_=+.-]/g, "-")
            .replace(/(-{2,}|-$)/g, "-")
            .replace(/-$/, "")
            .substring(0, 32);
          res.header(
            "Content-Disposition",
            `attachment; filename="${configName || clientId}.conf"`
          );
          res.header("Content-Type", "text/plain");
          res.send(config);
        })
      )
      .post(
        "/api/wireguard/client",
        Util.promisify(async (req: express.Request) => {
          const { name } = req.body;
          return WireGuard.createClient({ name });
        })
      )
      .delete(
        "/api/wireguard/client/:clientId",
        Util.promisify(async (req: express.Request) => {
          const { clientId } = req.params;
          return WireGuard.deleteClient({ clientId });
        })
      )
      .post(
        "/api/wireguard/client/:clientId/enable",
        Util.promisify(async (req: express.Request) => {
          const { clientId } = req.params;
          return WireGuard.enableClient({ clientId });
        })
      )
      .post(
        "/api/wireguard/client/:clientId/disable",
        Util.promisify(async (req: express.Request) => {
          const { clientId } = req.params;
          return WireGuard.disableClient({ clientId });
        })
      )
      .put(
        "/api/wireguard/client/:clientId/name",
        Util.promisify(async (req: express.Request) => {
          const { clientId } = req.params;
          const { name } = req.body;
          return WireGuard.updateClientName({ clientId, name });
        })
      )
      .put(
        "/api/wireguard/client/:clientId/address",
        Util.promisify(async (req: express.Request) => {
          const { clientId } = req.params;
          const { address } = req.body;
          return WireGuard.updateClientAddress({ clientId, address });
        })
      )

      .listen(PORT, () => {
        debug(`Listening on http://0.0.0.0:${PORT}`);
      });
  }
}
