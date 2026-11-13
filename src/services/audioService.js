const { spawn } = require("node:child_process");

const FFMPEG_PATH =
    "C:\\Users\\USER\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffmpeg.exe";

function convertToOgg(wavBuffer) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(FFMPEG_PATH, [
            "-f", "wav",
            "-i", "pipe:0",
            "-c:a", "libopus",
            "-b:a", "32k",
            "-vbr", "on",
            "-application", "voip",
            "-ar", "48000",
            "-ac", "1",
            "-f", "ogg",
            "pipe:1"
        ]);

        const output = [];
        const errors = [];

        ffmpeg.stdout.on("data", chunk => {
            output.push(chunk);
        });

        ffmpeg.stderr.on("data", chunk => {
            errors.push(chunk);
        });

        ffmpeg.on("error", error => {
            reject(error);
        });

        ffmpeg.on("close", code => {
            if (code !== 0) {
                reject(
                    new Error(
                        Buffer.concat(errors).toString() ||
                        "Audio conversion failed."
                    )
                );
                return;
            }

            resolve(Buffer.concat(output));
        });

        ffmpeg.stdin.on("error", error => {
            reject(error);
        });

        ffmpeg.stdin.end(wavBuffer);
    });
}

module.exports = {
    convertToOgg
};