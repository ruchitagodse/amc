"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, ScanLine } from "lucide-react";
import { resolveAssetQr } from "@/lib/domain";

function decode(canvas: HTMLCanvasElement): string {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !canvas.width || !canvas.height) return "";
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  return (
    jsQR(pixels.data, pixels.width, pixels.height, {
      inversionAttempts: "attemptBoth",
    })?.data || ""
  );
}
export function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  function stop() {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  useEffect(
    () => () => {
      generation.current++;
      if (timer.current) clearTimeout(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  function open(value: string) {
    try {
      const path = resolveAssetQr(value, location.origin);
      stop();
      location.href = path;
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  async function start() {
    stop();
    const attempt = generation.current;
    setError("");
    setActive(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera access requires HTTPS or localhost. Use a label image or URL below.",
        );
      const camera = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (attempt !== generation.current) {
        camera.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = camera;
      const preview = video.current!;
      preview.srcObject = camera;
      await preview.play();
      const canvas = document.createElement("canvas");
      const scan = () => {
        if (attempt !== generation.current) return;
        if (preview.readyState >= 2 && preview.videoWidth) {
          const scale = Math.min(1, 960 / preview.videoWidth);
          canvas.width = Math.round(preview.videoWidth * scale);
          canvas.height = Math.round(preview.videoHeight * scale);
          canvas
            .getContext("2d", { willReadFrequently: true })!
            .drawImage(preview, 0, 0, canvas.width, canvas.height);
          const result = decode(canvas);
          if (result && open(result)) return;
        }
        timer.current = setTimeout(scan, 150);
      };
      scan();
    } catch (e) {
      if (attempt !== generation.current) return;
      stop();
      setActive(false);
      setError(
        e instanceof Error
          ? e.message
          : "Camera unavailable. Check camera permissions.",
      );
    }
  }
  async function scanImage(file?: File) {
    if (!file) return;
    stop();
    setActive(false);
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const picture = new window.Image();
      picture.src = url;
      await picture.decode();
      if (picture.naturalWidth * picture.naturalHeight > 25_000_000)
        throw new Error("Image too large. Use a smaller label image.");
      const canvas = document.createElement("canvas");
      canvas.width = picture.naturalWidth;
      canvas.height = picture.naturalHeight;
      canvas
        .getContext("2d", { willReadFrequently: true })!
        .drawImage(picture, 0, 0);
      const result = decode(canvas);
      if (!result)
        throw new Error(
          "No readable asset QR found in this image. Try a clear PNG of the label.",
        );
      open(result);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to read this label image.",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return (
    <section className="panel scan-panel">
      <div className="scan-icon">
        <ScanLine size={38} />
      </div>
      <h2>Scan an asset label</h2>
      <p className="muted">
        Point your camera at an AssetDesk QR code to open its public asset
        information card.
      </p>
      <video
        ref={video}
        muted
        playsInline
        className={active ? "camera" : "camera hidden"}
      />
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <button
        className="btn-primary"
        onClick={() => {
          if (active) {
            stop();
            setActive(false);
          } else void start();
        }}
      >
        <Camera size={17} />
        {active ? "Stop camera" : "Start camera"}
      </button>
      <label className="image-scan">
        Scan label image
        <input
          type="file"
          accept="image/*"
          onChange={(e) => void scanImage(e.target.files?.[0])}
        />
      </label>
      <div className="scan-divider">or open a label URL</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          open(String(new FormData(e.currentTarget).get("url")));
        }}
      >
        <label>
          Asset QR URL
          <input
            name="url"
            placeholder="https://your-host/public/assets/…"
            required
          />
        </label>
        <button className="btn-secondary">Open asset</button>
      </form>
    </section>
  );
}
