export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';
export interface Appreciation {
    id: string;
    writingId: string;
    userId: string;
    userDisplayName?: string;
    reactionType: ReactionType;
    createdAt: string;
}
//# sourceMappingURL=Appreciation.d.ts.map