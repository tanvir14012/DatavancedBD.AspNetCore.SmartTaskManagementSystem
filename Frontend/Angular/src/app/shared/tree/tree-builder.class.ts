export interface FlatEntity<Id extends string | number = string | number> {
  id: Id;
  parentId: Id | null;
}

export interface TreeNode<T extends FlatEntity<Id>, Id extends string | number = T['id']> {
  id: Id;
  parentId: Id | null;
  data: T;
  children: TreeNode<T, Id>[];
}

export class TreeBuilder {
  static build<T extends FlatEntity<Id>, Id extends string | number = T['id']>(
    items: readonly T[],
  ): TreeNode<T, Id>[] {
    const nodeMap = new Map<Id, TreeNode<T, Id>>();
    const roots: TreeNode<T, Id>[] = [];

    for (const item of items) {
      nodeMap.set(item.id, {
        id: item.id,
        parentId: item.parentId,
        data: item,
        children: [],
      });
    }

    for (const item of items) {
      const currentNode = nodeMap.get(item.id);
      if (!currentNode) {
        continue;
      }

      if (item.parentId === null) {
        roots.push(currentNode);
        continue;
      }

      const parentNode = nodeMap.get(item.parentId);
      if (parentNode) {
        parentNode.children.push(currentNode);
      } else {
        roots.push(currentNode);
      }
    }

    return roots;
  }
}
