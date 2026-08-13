/**
 * A binary min-heap used by the React scheduler for managing task and timer queues.
 *
 * The heap is implemented as a flat array where each node has a `sortIndex`
 * used for ordering. Smaller `sortIndex` values bubble to the top.
 *
 * @module SchedulerMinHeap
 */

/** A node on the heap — any table with a `sortIndex` number. */
export interface HeapNode {
	readonly id: number;
	sortIndex: number;
}

type Heap = Array<HeapNode | undefined>;

/**
 * Insert a node into the heap, maintaining min-heap order.
 *
 * @param heap - The heap array.
 * @param node - The node to insert.
 */
export function push(heap: Heap, node: HeapNode): void {
	const index = heap.size() + 1;
	heap[index] = node;
	siftUp(heap, node, index);
}

/**
 * Return the top (smallest) node without removing it.
 *
 * @param heap - The heap array.
 * @returns The top node, or `undefined` if the heap is empty.
 */
export function peek(heap: Heap): HeapNode | undefined {
	return heap[1];
}

/**
 * Remove and return the top (smallest) node from the heap.
 *
 * @param heap - The heap array.
 * @returns The top node, or `undefined` if the heap is empty.
 */
export function pop(heap: Heap): HeapNode | undefined {
	const first = heap[1];
	if (first === undefined) {
		return undefined;
	}

	const last = heap[heap.size()];
	heap[heap.size()] = undefined;

	if (last !== undefined && last !== first) {
		heap[1] = last;
		siftDown(heap, last, 1);
	}

	return first;
}

/**
 * Compare two heap nodes by their `sortIndex`.
 *
 * @param a - First node.
 * @param b - Second node.
 * @returns Negative if `a` comes first, positive if `b` comes first.
 */
function compare(a: HeapNode, b: HeapNode): number {
	return a.sortIndex - b.sortIndex;
}

/**
 * Bubble a node up until the min-heap property is restored.
 *
 * @param heap - The heap array.
 * @param node - The node being sifted.
 * @param i - The current index of the node.
 */
function siftUp(heap: Heap, node: HeapNode, i: number): void {
	let index = i;

	while (index > 1) {
		const parentIndex = math.floor(index / 2);
		const parent = heap[parentIndex];

		if (parent !== undefined && compare(parent, node) > 0) {
			// The parent is larger — swap positions.
			heap[parentIndex] = node;
			heap[index] = parent;
			index = parentIndex;
		} else {
			// The parent is smaller — exit.
			return;
		}
	}
}

/**
 * Bubble a node down until the min-heap property is restored.
 *
 * @param heap - The heap array.
 * @param node - The node being sifted.
 * @param i - The current index of the node.
 */
function siftDown(heap: Heap, node: HeapNode, i: number): void {
	const length = heap.size();
	let index = i;

	while (index < length) {
		const leftIndex = index * 2;
		const left = heap[leftIndex];
		const rightIndex = leftIndex + 1;
		const right = heap[rightIndex];

		let smallerChild: HeapNode | undefined;
		let smallerChildIndex: number;

		if (right !== undefined && left !== undefined && compare(right, left) < 0) {
			smallerChild = right;
			smallerChildIndex = rightIndex;
		} else if (left !== undefined) {
			smallerChild = left;
			smallerChildIndex = leftIndex;
		} else {
			// No children — exit.
			return;
		}

		if (smallerChild !== undefined && compare(node, smallerChild) > 0) {
			// The child is smaller — swap positions.
			heap[index] = smallerChild;
			heap[smallerChildIndex] = node;
			index = smallerChildIndex;
		} else {
			// The parent is smaller — exit.
			return;
		}
	}
}
