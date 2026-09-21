import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestCard } from "./request-card";
import type { FriendRequest } from "@/types/friends";

const onAccept = vi.fn();
const onDecline = vi.fn();

function request(name = "Ali Khan", city = "Lahore"): FriendRequest {
  return {
    id: 3,
    from_person: { id: 7, display_name: name, city },
    to_person: { id: 1, display_name: "Zohaib Sadiq", city: "Lahore" },
    status: "SENT",
    status_label: "Waiting for an answer",
    created_at: "2026-09-19T08:00:00Z",
  };
}

beforeEach(() => {
  onAccept.mockReset();
  onDecline.mockReset();
});

const nameBox = () => screen.getByLabelText(/what do you want to call them/i);
const yesButton = () => screen.getByRole("button", { name: /yes, add them/i });

describe("RequestCard", () => {
  it("shows who is asking, and where they are", () => {
    render(<RequestCard request={request()} takenNames={[]} onAccept={onAccept} onDecline={onDecline} />);
    expect(screen.getByText("Ali Khan")).toBeInTheDocument();
    expect(screen.getByText(/lahore/i)).toBeInTheDocument();
  });

  it("starts with their real name already filled in", () => {
    render(<RequestCard request={request()} takenNames={[]} onAccept={onAccept} onDecline={onDecline} />);
    expect(nameBox()).toHaveValue("Ali Khan");
  });

  it("accepts with the name that was typed", async () => {
    render(<RequestCard request={request()} takenNames={[]} onAccept={onAccept} onDecline={onDecline} />);
    await userEvent.clear(nameBox());
    await userEvent.type(nameBox(), "Ali from college");
    await userEvent.click(yesButton());
    expect(onAccept).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }), "Ali from college");
  });

  it("refuses a name another friend already has", () => {
    render(
      <RequestCard request={request()} takenNames={["Ali Khan"]} onAccept={onAccept} onDecline={onDecline} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/already have a friend called Ali Khan/i);
    expect(yesButton()).toBeDisabled();
  });

  it("does not let capitals sneak a duplicate past it", () => {
    render(
      <RequestCard request={request()} takenNames={["ALI KHAN"]} onAccept={onAccept} onDecline={onDecline} />,
    );
    expect(yesButton()).toBeDisabled();
  });

  it("lets them in once a different name is typed", async () => {
    render(
      <RequestCard request={request()} takenNames={["Ali Khan"]} onAccept={onAccept} onDecline={onDecline} />,
    );
    expect(yesButton()).toBeDisabled();

    await userEvent.clear(nameBox());
    await userEvent.type(nameBox(), "Ali (work)");
    expect(yesButton()).toBeEnabled();

    await userEvent.click(yesButton());
    expect(onAccept).toHaveBeenCalledWith(expect.anything(), "Ali (work)");
  });

  it("refuses an empty name", async () => {
    render(<RequestCard request={request()} takenNames={[]} onAccept={onAccept} onDecline={onDecline} />);
    await userEvent.clear(nameBox());
    expect(yesButton()).toBeDisabled();
  });

  it("trims spaces before comparing, so a padded duplicate is still caught", async () => {
    render(
      <RequestCard request={request()} takenNames={["Ali Khan"]} onAccept={onAccept} onDecline={onDecline} />,
    );
    await userEvent.clear(nameBox());
    await userEvent.type(nameBox(), "  Ali Khan  ");
    expect(yesButton()).toBeDisabled();
  });

  it("can say no", async () => {
    render(<RequestCard request={request()} takenNames={[]} onAccept={onAccept} onDecline={onDecline} />);
    await userEvent.click(screen.getByRole("button", { name: /no thanks/i }));
    expect(onDecline).toHaveBeenCalled();
  });

  it("says plainly that only you see the name", () => {
    render(<RequestCard request={request()} takenNames={[]} onAccept={onAccept} onDecline={onDecline} />);
    expect(screen.getByText(/only you see this/i)).toBeInTheDocument();
  });

  it("copes with somebody who saved no city", () => {
    render(
      <RequestCard request={request("Ali Khan", "")} takenNames={[]} onAccept={onAccept} onDecline={onDecline} />,
    );
    expect(screen.getByText(/no city saved/i)).toBeInTheDocument();
  });
});
