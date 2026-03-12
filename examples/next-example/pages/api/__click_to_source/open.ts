import type { NextApiRequest, NextApiResponse } from "next";
import { createOpenRequestHandler } from "click-to-source/server";

const handler = createOpenRequestHandler({
  path: "/api/__click_to_source/open",
});

export default function open(req: NextApiRequest, res: NextApiResponse) {
  handler(req, res);
}
