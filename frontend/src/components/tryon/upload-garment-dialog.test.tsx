import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UploadGarmentDialog } from "./upload-garment-dialog";

const onSubmit = vi.fn();
const onOpenChange = vi.fn();

function open() {
  return render(
    <UploadGarmentDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />,
  );
}

function aPhoto() {
  return new File(["x"], "kurta.png", { type: "image/png" });
}

async function pickAFile() {
  // The dialog renders through a portal, so the input is found by its label
  // rather than inside the render container.
  await userEvent.upload(screen.getByLabelText(/the garment/i), aPhoto());
}

const tryButton = () => screen.getByRole("button", { name: /^try it on$/i });

beforeEach(() => {
  onSubmit.mockReset();
  onOpenChange.mockReset();
  // jsdom has no object URL support.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

describe("UploadGarmentDialog", () => {
  it("offers the three parts of the body the supplier can draw", () => {
    open();
    expect(screen.getByRole("button", { name: "Top half" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bottom half" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Full outfit" })).toBeInTheDocument();
  });

  it("explains why it has to ask, when the closet does not", () => {
    open();
    expect(screen.getByText(/closet items answer this on their own/i)).toBeInTheDocument();
  });

  it("will not start without a picture", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: "Top half" }));
    expect(tryButton()).toBeDisabled();
  });

  it("will not start without a part of the body chosen", async () => {
    open();
    await pickAFile();
    expect(tryButton()).toBeDisabled();
  });

  it("starts once both are given", async () => {
    open();
    await pickAFile();
    await userEvent.click(screen.getByRole("button", { name: "Top half" }));

    expect(tryButton()).toBeEnabled();
    await userEvent.click(tryButton());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ slot: "TOP", saveAs: "" }),
      expect.any(Function),
    );
  });

  it("sends the part of the body that was actually chosen", async () => {
    open();
    await pickAFile();
    await userEvent.click(screen.getByRole("button", { name: "Full outfit" }));
    await userEvent.click(tryButton());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ slot: "FULL_BODY" }),
      expect.any(Function),
    );
  });

  it("keeps nothing unless keeping is switched on", async () => {
    open();
    await pickAFile();
    await userEvent.click(screen.getByRole("button", { name: "Top half" }));
    expect(screen.queryByLabelText(/what is it called/i)).not.toBeInTheDocument();
  });

  it("asks for a name once keeping is switched on", async () => {
    open();
    await pickAFile();
    await userEvent.click(screen.getByRole("button", { name: /keep it in my closet/i }));
    expect(screen.getByLabelText(/what is it called/i)).toBeInTheDocument();
  });

  it("will not start with keeping on and no name", async () => {
    open();
    await pickAFile();
    await userEvent.click(screen.getByRole("button", { name: "Top half" }));
    await userEvent.click(screen.getByRole("button", { name: /keep it in my closet/i }));
    expect(tryButton()).toBeDisabled();
  });

  it("sends the name when one is given", async () => {
    open();
    await pickAFile();
    await userEvent.click(screen.getByRole("button", { name: "Bottom half" }));
    await userEvent.click(screen.getByRole("button", { name: /keep it in my closet/i }));
    await userEvent.type(screen.getByLabelText(/what is it called/i), "Black Trousers");
    await userEvent.click(tryButton());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ slot: "BOTTOM", saveAs: "Black Trousers" }),
      expect.any(Function),
    );
  });

  it("shows a failure from the server inside the dialog, not as a toast", async () => {
    onSubmit.mockImplementation((_payload, onFailure) => onFailure("That photo was refused."));
    open();
    await pickAFile();
    await userEvent.click(screen.getByRole("button", { name: "Top half" }));
    await userEvent.click(tryButton());

    expect(screen.getByRole("alert")).toHaveTextContent("That photo was refused.");
  });

  it("closes without sending anything when cancelled", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
