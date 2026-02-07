export interface Comment {
    id: string;
    writingId: string;
    userId: string;
    userDisplayName?: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}
export interface CreateCommentRequest {
    content: string;
}
//# sourceMappingURL=Comment.d.ts.map