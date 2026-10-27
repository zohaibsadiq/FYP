import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoField } from "./photo-field";
import type { ImageUploadResult } from "@/types/wardrobe";

const uploadMutate = vi.fn();
const discardMutate = vi.fn();

vi.mock("@/hooks/use-wardrobe", () => ({
  useUploadGarmentImage: () => ({ mutate: uploadMutate, isPending: false }),
  useDiscardUpload: () => ({ mutate: discardMutate }),
}));
vi.mock("@/components/wardrobe/photo-guide", () => ({ PhotoGuide: () => <p>photo guide</p> }));

const RESULT: ImageUploadResult = {
  original_image_url: "https://images.test/original.jpg",
  original_image_public_id: "closette/garments/original/u1/a",
  clean_image_url: "https://images.test/clean.png",
  clean_image_public_id: "closette/garments/clean/u1/b",
  detected: { primary_color_hex: "#1b2f55", primary_color_name: "Navy", width: 10, height: 10 },
  processing_ms: 1200,
  coverage: 0.4,
  warning: null,
};

/** Holds the field's answers the way a form would. */
function Harness(props: {
  current?: string;
  onUploaded?: (result: ImageUploadResult | null) => void;
  onRemoved?: (removed: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [uploaded, setUploaded] = useState<ImageUploadResult | null>(null);
  const [removed, setRemoved] = useState(false);
  return (
    <PhotoField
      slot="TOP"
      current={props.current}
      uploaded={uploaded}
      removed={removed}
      onUploaded={(result) => {
        setUploaded(result);
        props.onUploaded?.(result);
      }}
      onRemoved={(value) => {
        setRemoved(value);
        props.onRemoved?.(value);
      }}
      onBusyChange={props.onBusyChange}
    />
  );
}

function pickFile(bytes = 1000) {
  const file = new File(["x"], "kurta.jpg", { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: bytes });
  return userEvent.upload(screen.getByLabelText("Choose a photo"), file);
}

beforeEach(() => {
  uploadMutate.mockReset();
  discardMutate.mockReset();
  // The upload answers at once, the way a stand-in server would.
  uploadMutate.mockImplementation((_input, opts) => {
    opts.onSuccess(RESULT);
    opts.onSettled();
  });
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

describe("PhotoField", () => {
  it("invites a photo, with the guide, when there is none yet", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: /take or choose a photo/i })).toBeInTheDocument();
    expect(screen.getByText("photo guide")).toBeInTheDocument();
  });

  it("shows the saved photo with ways to change or remove it", () => {
    render(<Harness current="https://images.test/old.png" />);
    expect(screen.getByAltText("The photo saved now")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove photo/i })).toBeInTheDocument();
  });

  it("asks for the saved photo to be removed, and can take that back", async () => {
    const onRemoved = vi.fn();
    render(<Harness current="https://images.test/old.png" onRemoved={onRemoved} />);

    await userEvent.click(screen.getByRole("button", { name: /remove photo/i }));
    expect(onRemoved).toHaveBeenLastCalledWith(true);
    expect(screen.getByText(/will be removed when you save/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /keep it/i }));
    expect(onRemoved).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: /change photo/i })).toBeInTheDocument();
  });

  it("sends a chosen photo away and shows the cutout and its colour", async () => {
    const onUploaded = vi.fn();
    const onBusyChange = vi.fn();
    render(<Harness onUploaded={onUploaded} onBusyChange={onBusyChange} />);

    await pickFile();

    expect(uploadMutate).toHaveBeenCalledTimes(1);
    expect(onUploaded).toHaveBeenLastCalledWith(RESULT);
    expect(onBusyChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
    expect(screen.getByAltText("The item with its background removed")).toBeInTheDocument();
    expect(screen.getByText(/we think this is navy/i)).toBeInTheDocument();
  });

  it("refuses a photo that is too big before sending anything", async () => {
    render(<Harness />);

    await pickFile(13 * 1024 * 1024);

    expect(uploadMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/too big/i);
  });

  it("lets go of an upload when a different photo is wanted", async () => {
    const onUploaded = vi.fn();
    render(<Harness onUploaded={onUploaded} />);
    await pickFile();

    await userEvent.click(screen.getByRole("button", { name: /use a different photo/i }));

    expect(discardMutate).toHaveBeenCalledWith([
      "closette/garments/original/u1/a",
      "closette/garments/clean/u1/b",
    ]);
    expect(onUploaded).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("button", { name: /take or choose a photo/i })).toBeInTheDocument();
  });

  it("explains when the server could not use the photo", async () => {
    uploadMutate.mockImplementation((_input, opts) => {
      opts.onError(new Error("That photo could not be used."));
      opts.onSettled();
    });
    render(<Harness />);

    await pickFile();

    expect(screen.getByRole("alert")).toHaveTextContent(/could not be used/i);
    expect(screen.getByRole("button", { name: /take or choose a photo/i })).toBeInTheDocument();
  });
});
