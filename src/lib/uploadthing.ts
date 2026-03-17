import { createRouteHandler, createUploadthing } from "uploadthing/express";
import type { FileRouter } from "uploadthing/express";
import { POST_MEDIA_MAX_COUNT } from "../constants.ts";

const f = createUploadthing();

const uploadRouter = {
  mediaUploader: f({
    image: { maxFileSize: "16MB", maxFileCount: POST_MEDIA_MAX_COUNT },
    video: { maxFileSize: "64MB", maxFileCount: POST_MEDIA_MAX_COUNT }
  }).onUploadComplete(({ file }) => {}),
  imageUploader: f({
    image: { maxFileSize: "16MB", maxFileCount: 1 }
  }).onUploadComplete(({ file }) => {}),
} satisfies FileRouter;

export const uploadthingRouter = createRouteHandler({ router: uploadRouter });