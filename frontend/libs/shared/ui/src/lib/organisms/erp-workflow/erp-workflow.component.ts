import { ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, input, signal, contentChild, TemplateRef, AfterViewInit, ViewChild, isSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpWorkflowNodeComponent } from './erp-workflow-node.component';
import { WorkflowEdge, WorkflowNode, WorkflowNodeAction, WorkflowNodeType, ErpWorkflowConfig } from './erp-workflow.types';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { MenuItem } from 'primeng/api';
import { ErpWorkflowBuilder } from './erp-workflow.builder';
import { ErpContextMenuBuilder, ErpContextMenuComponent } from '@erp/shared/ui/erp-context-menu';
import { ErpMenubarBuilder, ErpMenubarComponent } from '@erp/shared/ui/erp-menubar';

export { ErpWorkflowBuilder };

@Component({
  selector: 'erp-workflow',
  standalone: true,
  imports: [CommonModule, ErpWorkflowNodeComponent, ErpMenubarComponent, ErpContextMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './erp-workflow.component.html',
  styles: [
    `
      ::ng-deep .p-contextmenu .p-submenu-list,
      ::ng-deep .p-menubar .p-submenu-list {
        max-height: 400px;
        overflow-y: auto;
      }
      @keyframes spin-slow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .animate-spin-slow {
        animation: spin-slow 2s linear infinite;
      }
    `,
  ],
})
export class ErpWorkflowComponent implements AfterViewInit {
  public config = input.required<ErpWorkflowConfig>();

  protected nodes = computed(() => unwrapSignal(this.config().nodes) || []);
  protected edges = computed(() => unwrapSignal(this.config().edges) || []);
  protected readonlyMode = computed(() => unwrapSignal(this.config().readonlyMode) || false);
  protected actions = computed(() => unwrapSignal(this.config().actions) || []);
  protected availableNodeTypes = computed(() => unwrapSignal(this.config().availableNodeTypes) || []);

  nodeTemplate = contentChild(TemplateRef);

  private nodeTypeActionsMap = computed(() => {
    const map = new Map<string, WorkflowNodeAction[]>();

    const flatten = (items: WorkflowNodeType[]) => {
      items.forEach((item) => {
        if (item.type && item.actions) {
          map.set(item.type, item.actions);
        }
        if (item.items) {
          flatten(item.items);
        }
      });
    };

    flatten(this.availableNodeTypes());
    return map;
  });

  nodeTypeActions(node: WorkflowNode): WorkflowNodeAction[] {
    return this.nodeTypeActionsMap().get(node.type) || [];
  }

  private buildNodeMenuItems(types: WorkflowNodeType[], x?: number, y?: number): MenuItem[] {
    return types.map((nt) => {
      if (nt.items && nt.items.length > 0) {
        return {
          label: nt.label,
          icon: nt.icon || 'pi pi-folder',
          items: this.buildNodeMenuItems(nt.items, x, y),
        };
      } else {
        return {
          label: nt.label,
          icon: nt.icon || 'pi pi-plus-circle',
          command: () => {
            if (x !== undefined && y !== undefined) {
              this.addNode(nt.type!, nt.label, nt.defaultWidth, x, y);
            } else {
              this.addNode(nt.type!, nt.label, nt.defaultWidth);
            }
          },
        };
      }
    });
  }

  menubarConfig = computed(() => ErpMenubarBuilder.create((b) => b.setItems(this.menubarItems())));

  contextMenuConfig = computed(() => ErpContextMenuBuilder.create((b) => b.setItems(this.contextMenuItems)));

  @ViewChild('canvasContextMenu') canvasContextMenu!: ErpContextMenuComponent;

  menubarItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [];

    if (!this.readonlyMode() && this.availableNodeTypes().length > 0) {
      items.push({
        label: 'Dodaj Węzeł',
        icon: 'pi pi-plus',
        items: this.buildNodeMenuItems(this.availableNodeTypes()),
      });
    }

    items.push({
      label: 'Wyśrodkuj widok',
      icon: 'pi pi-search-minus',
      command: () => this.resetZoom(),
    });

    return items;
  });

  contextMenuPosition = signal<{ x: number; y: number } | null>(null);

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if (this.readonlyMode()) return;

    // Prevent triggering context menu if we right-click on a node
    if ((event.target as HTMLElement).closest('erp-workflow-node')) {
      return;
    }

    const rect = this.el.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.pan().x) / this.zoom();
    const y = (event.clientY - rect.top - this.pan().y) / this.zoom();

    this.contextMenuPosition.set({ x, y });
    this.canvasContextMenu.show(event);
  }

  contextMenuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [];
    const pos = this.contextMenuPosition();

    if (!this.readonlyMode() && this.availableNodeTypes().length > 0) {
      items.push({
        label: 'Dodaj Węzeł',
        icon: 'pi pi-plus',
        items: this.buildNodeMenuItems(this.availableNodeTypes(), pos?.x, pos?.y),
      });
    }

    items.push({
      label: 'Wyśrodkuj widok',
      icon: 'pi pi-search-minus',
      command: () => this.resetZoom(),
    });

    return items;
  });

  // Viewport State
  pan = signal({ x: 0, y: 0 });
  zoom = signal(1);

  // Interaction State
  private draggedNode = signal<WorkflowNode | null>(null);
  private dragOffset = { x: 0, y: 0 };
  private canvasDragging = false;
  private canvasDragStart = { x: 0, y: 0 };

  // Connection State
  drawingEdge = signal<{ sourceId: string; sourceHandle: string; startX: number; startY: number; endX: number; endY: number } | null>(null);

  el = inject(ElementRef);

  isInitialized = signal(false);

  ngAfterViewInit() {
    // Wait for the next tick to ensure DOM is rendered and dimensions are available
    setTimeout(() => {
      this.resetZoom();
      this.isInitialized.set(true);
    }, 0);
  }

  transformStyle = computed(() => {
    return `translate(${this.pan().x}px, ${this.pan().y}px) scale(${this.zoom()})`;
  });

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.draggedNode()) {
      const node = this.draggedNode()!;
      // Calculate new position based on zoom
      const newX = (event.clientX - this.dragOffset.x - this.pan().x) / this.zoom();
      const newY = (event.clientY - this.dragOffset.y - this.pan().y) / this.zoom();

      this.updateNodes(this.nodes().map((n) => (n.id === node.id ? { ...n, position: { x: newX, y: newY } } : n)));
    } else if (this.canvasDragging) {
      const dx = event.clientX - this.canvasDragStart.x;
      const dy = event.clientY - this.canvasDragStart.y;
      this.pan.update((p) => ({ x: p.x + dx, y: p.y + dy }));
      this.canvasDragStart = { x: event.clientX, y: event.clientY };
    } else if (this.drawingEdge()) {
      // Update drawing edge end point
      const rect = this.el.nativeElement.getBoundingClientRect();
      const endX = (event.clientX - rect.left - this.pan().x) / this.zoom();
      const endY = (event.clientY - rect.top - this.pan().y) / this.zoom();
      this.drawingEdge.update((e) => (e ? { ...e, endX, endY } : null));
    }
  }

  @HostListener('window:mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    this.draggedNode.set(null);
    this.canvasDragging = false;

    // Check if we were drawing an edge and finished over a node
    if (this.drawingEdge()) {
      const targetNode = this.findNodeAtEvent(event);
      if (targetNode && targetNode.id !== this.drawingEdge()!.sourceId) {
        // Create new edge
        const newEdge: WorkflowEdge = {
          id: `e_${Date.now()}`,
          sourceId: this.drawingEdge()!.sourceId,
          targetId: targetNode.id,
          sourceHandle: this.drawingEdge()!.sourceHandle,
        };
        this.updateEdges([...this.edges(), newEdge]);
      }
      this.drawingEdge.set(null);
    }
  }

  onCanvasMouseDown(event: MouseEvent): void {
    // If the click wasn't stopped by a node (e.g. in readonly mode or empty space), we drag the canvas
    this.canvasDragging = true;
    this.canvasDragStart = { x: event.clientX, y: event.clientY };
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomDelta = event.deltaY > 0 ? 0.9 : 1.1;
    this.zoom.update((z) => Math.max(0.1, Math.min(z * zoomDelta, 3)));
  }

  onNodeDragStart(event: MouseEvent, node: WorkflowNode): void {
    if (this.readonlyMode()) return;
    this.draggedNode.set(node);
    // Calculate offset relative to the node's top-left corner taking zoom into account
    this.dragOffset = {
      x: event.clientX - (node.position.x * this.zoom() + this.pan().x),
      y: event.clientY - (node.position.y * this.zoom() + this.pan().y),
    };
  }

  onConnectionStart(data: { event: MouseEvent; sourceHandle: string }, node: WorkflowNode): void {
    if (this.readonlyMode()) return;
    const rect = this.el.nativeElement.getBoundingClientRect();
    const startX = (data.event.clientX - rect.left - this.pan().x) / this.zoom();
    const startY = (data.event.clientY - rect.top - this.pan().y) / this.zoom();

    this.drawingEdge.set({
      sourceId: node.id,
      sourceHandle: data.sourceHandle,
      startX,
      startY,
      endX: startX,
      endY: startY,
    });
  }

  resetZoom(): void {
    const nodes = this.nodes();
    if (!nodes.length) {
      this.pan.set({ x: 0, y: 0 });
      this.zoom.set(1);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      const w = n.width || 200;
      const h = n.type === 'and' || n.type === 'or' ? 60 : 150; // rough height estimate
      if (n.position.x < minX) minX = n.position.x;
      if (n.position.y < minY) minY = n.position.y;
      if (n.position.x + w > maxX) maxX = n.position.x + w;
      if (n.position.y + h > maxY) maxY = n.position.y + h;
    });

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    const rect = this.el.nativeElement.getBoundingClientRect();
    const padding = 60; // minimum padding

    const viewWidth = rect.width - padding * 2;
    const viewHeight = rect.height - padding * 2;

    if (viewWidth <= 0 || viewHeight <= 0) return;

    const zoomX = viewWidth / graphWidth;
    const zoomY = viewHeight / graphHeight;

    // Fit to view, but cap at 1.2x zoom so small graphs don't become massive
    let newZoom = Math.min(zoomX, zoomY, 1.2);
    // Limit min zoom just in case
    newZoom = Math.max(0.1, newZoom);

    // Center panning
    const panX = (rect.width - graphWidth * newZoom) / 2 - minX * newZoom;
    const panY = (rect.height - graphHeight * newZoom) / 2 - minY * newZoom;

    this.zoom.set(newZoom);
    this.pan.set({ x: panX, y: panY });
  }

  addNode(type: string, label: string, defaultWidth?: number, x?: number, y?: number): void {
    let positionX = x;
    let positionY = y;

    if (positionX === undefined || positionY === undefined) {
      const rect = this.el.nativeElement.getBoundingClientRect();
      positionX = (rect.width / 2 - this.pan().x) / this.zoom();
      positionY = (rect.height / 2 - this.pan().y) / this.zoom();
    }

    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type,
      label,
      position: { x: positionX - (defaultWidth || 200) / 2, y: positionY - 50 },
      width: defaultWidth || 200,
      metadata: {},
    };

    this.updateNodes([...this.nodes(), newNode]);
  }

  deleteNode(nodeId: string): void {
    this.updateNodes(this.nodes().filter((n) => n.id !== nodeId));
    this.updateEdges(this.edges().filter((e) => e.sourceId !== nodeId && e.targetId !== nodeId));
  }

  deleteEdge(edgeId: string): void {
    this.updateEdges(this.edges().filter((e) => e.id !== edgeId));
  }

  onNodeHeightChange(event: { id: string; height: number }): void {
    this.updateNodes(this.nodes().map((n) => (n.id === event.id ? { ...n, height: event.height } : n)));
  }

  private updateNodes(nodes: WorkflowNode[]): void {
    const config = this.config();
    const nodesRef = config.nodes;
    if (isSignal(nodesRef) && 'set' in nodesRef) {
      (nodesRef as any).set(nodes);
    } else if (config.onNodesChange) {
      config.onNodesChange(nodes);
    }
  }

  private updateEdges(edges: WorkflowEdge[]): void {
    const config = this.config();
    const edgesRef = config.edges;
    if (isSignal(edgesRef) && 'set' in edgesRef) {
      (edgesRef as any).set(edges);
    } else if (config.onEdgesChange) {
      config.onEdgesChange(edges);
    }
  }

  // --- SVG Path Calculation ---

  calculateEdgePath(edge: WorkflowEdge): string {
    const sourceNode = this.nodes().find((n) => n.id === edge.sourceId);
    const targetNode = this.nodes().find((n) => n.id === edge.targetId);

    if (!sourceNode || !targetNode) return '';

    const w1 = sourceNode.width || 200;
    const w2 = targetNode.width || 200;

    // Calculate source point
    let startX = sourceNode.position.x + w1 / 2;
    const isGateway = sourceNode.type === 'and' || sourceNode.type === 'or';
    let startY = sourceNode.position.y + (sourceNode.height || (isGateway ? 60 : 100)); // use dynamic height if available

    if (sourceNode.type === 'condition') {
      if (edge.sourceHandle === 'false') startX = sourceNode.position.x + w1 / 4;
      if (edge.sourceHandle === 'true') startX = sourceNode.position.x + (w1 * 3) / 4;
    }

    // Calculate target point
    const endX = targetNode.position.x + w2 / 2;
    const endY = targetNode.position.y;

    return this.createBezierCurve(startX, startY, endX, endY);
  }

  calculateDrawingEdgePath(): string {
    const e = this.drawingEdge();
    if (!e) return '';
    return this.createBezierCurve(e.startX, e.startY, e.endX, e.endY);
  }

  private createBezierCurve(startX: number, startY: number, endX: number, endY: number): string {
    // Simple vertical bezier curve
    const controlPointY = startY + Math.abs(endY - startY) / 2;
    return `M ${startX} ${startY} C ${startX} ${controlPointY}, ${endX} ${controlPointY}, ${endX} ${endY}`;
  }

  private findNodeAtEvent(event: MouseEvent): WorkflowNode | undefined {
    const rect = this.el.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.pan().x) / this.zoom();
    const y = (event.clientY - rect.top - this.pan().y) / this.zoom();

    return this.nodes().find((n) => {
      const w = n.width || 200;
      const h = 100; // approximate height, in a real scenario we'd track actual height
      return x >= n.position.x && x <= n.position.x + w && y >= n.position.y && y <= n.position.y + h;
    });
  }
}
