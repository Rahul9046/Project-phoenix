import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * How the Next build is turned into a Cloudflare Worker.
 *
 * Deliberately bare. The documented example wires an R2 bucket as an
 * incremental cache, which is the right answer for a site with many
 * statically-regenerated pages -- and this is not one. The production build
 * marks nearly every route dynamic, so there is almost nothing for that cache
 * to hold, and an R2 bucket would be a binding to provision, a resource to
 * name, and another thing to get wrong on a first deployment for no measurable
 * gain.
 *
 * When ISR arrives -- a members directory, a cached city page -- add the R2
 * override then, with something real to measure it against.
 */
export default defineCloudflareConfig();
