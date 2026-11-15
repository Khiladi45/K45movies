import { execFileSync, spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { compatibilityArgs } from "../../src/server/media-compatibility";

const [output] = process.argv.slice(2);
const ffmpeg = process.env.K45_FFMPEG_PATH;
if (!output || !ffmpeg) throw Error("Set K45_FFMPEG_PATH and pass OUTPUT.json.");
const tmp = await mkdtemp(join(tmpdir(), "k45-ffmpeg-bench-"));
const input = join(tmp, "sample.mkv");
try {
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=24",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "30",
    "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "eac3", input]);
  const timings = [];
  for (let i = 0; i < 3; i++) {
    const args = ["-benchmark", ...compatibilityArgs.map((value) => value === "error" ? "info" : value)];
    const command = spawn(ffmpeg, args, { windowsHide: true, stdio: ["pipe", "ignore", "pipe"] });
    let messages = "";
    command.stderr.setEncoding("utf8").on("data", (chunk) => { messages += chunk; });
    const completed = new Promise<void>((resolve, reject) => {
      command.once("error", reject);
      command.once("close", (code) => code === 0 ? resolve() : reject(Error(messages)));
    });
    await Promise.all([completed, pipeline(createReadStream(input), command.stdin)]);
    const values = /utime=(\S+)s stime=(\S+)s rtime=(\S+)s/.exec(messages);
    if (!values) throw Error("FFmpeg did not print benchmark timings.");
    const [, user, system, wall] = values.map(Number);
    timings.push({ user, system, wall, cpu: +(user + system).toFixed(3) });
  }
  const version = execFileSync(ffmpeg, ["-version"], { encoding: "utf8" }).split(/\r?\n/)[0];
  await writeFile(output, JSON.stringify({ version, machine: cpus()[0]?.model, durationSeconds: 30,
    fixture: "1280x720/24 fps H.264 + E-AC-3 in Matroska", output: "fragmented MP4, H.264 copy, stereo AAC", timings }, null, 2) + "\n");
} finally { await rm(tmp, { recursive: true, force: true }); }
