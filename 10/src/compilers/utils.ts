export const getTagAndString = (
    taggedExpression: string
): {
    tag: string;
    string: string;
} => {
    const match = taggedExpression.match(/<(.+?)>\s(.+?)\s<\/.+?>/);
    if (match && match[1] && match[2]) {
        return {
            tag: match[1],
            string: match[2],
        };
    } else {
        throw new Error("Malformed tagged expression: " + taggedExpression);
    }
};
