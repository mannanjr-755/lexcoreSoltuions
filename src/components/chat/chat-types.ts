export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  isOnline: boolean;
}

export interface Attachment {
  id: string;
  type: "image" | "file";
  url: string;
  name: string;
  size: number;
  mime: string;
  createdAt?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  status: "sent" | "delivered" | "read";
  isEdited: boolean;
  isDeleted: boolean;
  replyToId?: string | null;
  replyToText?: string | null;
  replyToSenderName?: string | null;
  attachments: Attachment[];
}

export interface Workspace {
  id: string;
  name: string;
  members: TeamMember[];
}
