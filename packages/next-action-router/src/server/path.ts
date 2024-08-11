import { BRANCH_DELIMITER, COMMON_DELIMITER } from "./constants";

type PathSegment =
  | {
      name: string;
      type: "common";
    }
  | {
      type: "branch";
    };

type SegmentStylePredicate = (ctx: {
  type: "common";
  isFirst: boolean;
  isLast: boolean;
  name: string;
}) => string;

export class ActionPath {
  private delimiters = {
    branch: BRANCH_DELIMITER, // represents branch diversion in a action path
    common: COMMON_DELIMITER, // represents any flow other than branch diversions
  };
  private segments: PathSegment[] = [];

  constructor(private rootName: string = "root") {
    this.segments.push({
      name: rootName,
      type: "common",
    });
  }

  /**
   * To push a new segment in action path
   */
  push(type: "branch"): this;
  push(type: Exclude<PathSegment["type"], "branch">, name: string): this;
  push(type: PathSegment["type"], name?: unknown) {
    if (type === "branch") {
      this.segments.push({
        type: "branch",
      });
      return this;
    }

    if (typeof name !== "string") {
      throw Error("Segment name must be of `string` type");
    }

    this.segments.push({
      type: "common",
      name: name.toLowerCase(),
    });

    return this;
  }

  toString(segmentStylePredicate: SegmentStylePredicate = ({ name }) => name) {
    // normalizing segements to a legit action path string
    const normalizedSegments: string[] = [];
    for (let i = 0; i < this.segments.length; ++i) {
      const segment = this.segments[i];
      if (segment.type === "branch") {
        normalizedSegments.pop();
        normalizedSegments.push(this.delimiters.branch);
      } else {
        normalizedSegments.push(
          segmentStylePredicate({
            type: "common",
            name: segment.name,
            isFirst: i === 0,
            isLast: i === this.segments.length - 1,
          })
        );
        if (i < this.segments.length - 1)
          normalizedSegments.push(this.delimiters.common);
      }
    }
    return normalizedSegments.join(" ");
  }

  clone() {
    const path = new ActionPath(this.rootName);
    path.segments = [...this.segments];
    return path;
  }
}
