"use strict";

import type express from "express";

import childProcess from "child_process";

export default class Util {
  static isValidIPv4(str: string) {
    const blocks = str.split(".");
    if (blocks.length !== 4) return false;

    for (let value of blocks) {
      let numValue = parseInt(value, 10);
      if (Number.isNaN(numValue)) return false;
      if (numValue < 0 || numValue > 255) return false;
    }

    return true;
  }

  static debounce(
    func: (...args: any[]) => void,
    delay: number
  ): (...args: any[]) => void {
    let timeoutId: NodeJS.Timeout | null;

    return function debounced(...args: any[]) {
      clearTimeout(timeoutId!);
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  }

  static promisify(
    fn: (req: express.Request, res: express.Response) => Promise<any>
  ) {
    // eslint-disable-next-line func-names
    return function (req: express.Request, res: express.Response) {
      return Promise.resolve()
        .then(async () => fn(req, res))
        .then((result) => {
          if (res.headersSent) return;

          if (typeof result === "undefined") {
            return res.status(204).end();
          }

          return res.status(200).json(result);
        })
        .catch((error) => {
          if (typeof error === "string") {
            error = new Error(error);
          }

          // eslint-disable-next-line no-console
          console.error(error);

          return res.status(error.statusCode || 500).json({
            error: error.message || error.toString(),
            stack: error.stack,
          });
        });
    };
  }

  static async exec(
    cmd: string,
    config: { log: boolean | string } = { log: true }
  ): Promise<string> {
    if (typeof config.log === "string") {
      // eslint-disable-next-line no-console
      console.log(`$ ${config.log}`);
    } else if (config.log === true) {
      // eslint-disable-next-line no-console
      console.log(`$ ${cmd}`);
    }

    if (process.platform !== "linux") {
      return "";
    }

    return new Promise((resolve, reject) => {
      childProcess.exec(
        cmd,
        {
          shell: "bash",
        },
        (err, stdout) => {
          if (err) return reject(err);
          return resolve(String(stdout).trim());
        }
      );
    });
  }
}
