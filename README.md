# Dez Graph - Visual Programming Editor

A visual programming environment inspired by Unreal Engine Blueprints for creating and executing mathematical equations and algorithms through a node-based interface.

## Table of Contents
- [Getting Started](#getting-started)
- [Basic Concepts](#basic-concepts)
- [Node Types](#node-types)
- [Creating Equations](#creating-equations)
- [User Interface](#user-interface)
- [Development](#development)
- [Examples](#examples)

## Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- A modern web browser

### Installation
1. Clone or download the repository
2. Open a terminal in the project directory
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open your browser to `http://localhost:3000`

### First Steps
1. **Create nodes** by clicking on items in the left palette
2. **Connect nodes** by dragging from output ports to input ports
3. **Edit values** by selecting a node and changing values in the right panel
4. **Run your graph** by clicking the "Run Graph" button

## Basic Concepts

### Execution Flow vs Data Flow
The visual programming system uses two types of connections:

#### **Execution Flow (Purple Ports)**
- Controls the **order** of operations
- Determines **when** nodes execute
- Always flows from left to right
- Required for nodes that perform actions (like Print)

#### **Data Flow (Blue Ports)**
- Passes **values** between nodes
- Determines **what data** is processed
- Can connect to multiple inputs
- Updates automatically when source values change

### Port Types
- **Input Ports** (left side): Receive data or execution signals
- **Output Ports** (right side): Send data or execution signals
- **Port Labels**: Each port shows its name and data type

## Node Types

### Control Nodes

#### **Start Node**
- **Purpose**: Entry point for execution
- **Ports**: 
  - `exec` (output): Execution flow output
- **Usage**: Place at the beginning of your equation chain

#### **Print Node**
- **Purpose**: Display results and debug information
- **Ports**:
  - `exec` (input): When to execute
  - `in` (input): Value to display
- **Usage**: Connect to see equation results

### Data Nodes

#### **Number Node**
- **Purpose**: Provide constant numeric values
- **Ports**:
  - `num` (input): Editable number value
  - `v` (output): The number value
- **Usage**: 
  1. Create a Number node
  2. Select it and edit the `num` value in the properties panel
  3. Connect the `v` output to other nodes
- **Features**: Updates output immediately when you change the input

#### **Vec3 Node**
- **Purpose**: 3D vector with X, Y, Z components
- **Ports**:
  - `x`, `y`, `z` (inputs): Individual components
  - `v` (output): Complete vector object
- **Usage**: Create 3D vectors for geometric calculations

### Math Operations

#### **Add Node**
- **Purpose**: Addition operation (a + b)
- **Ports**:
  - `exec` (input/output): Execution flow
  - `a`, `b` (inputs): Numbers to add
  - `out` (output): Sum result
- **Example**: 5 + 3 = 8

#### **Multiply Node**
- **Purpose**: Multiplication operation (a × b)
- **Ports**:
  - `exec` (input/output): Execution flow
  - `a`, `b` (inputs): Numbers to multiply
  - `out` (output): Product result
- **Example**: 4 × 7 = 28

#### **Dot Product Node**
- **Purpose**: Vector dot product operation
- **Ports**:
  - `exec` (input/output): Execution flow
  - `a`, `b` (inputs): Vector3 objects
  - `out` (output): Dot product result
- **Formula**: a·b = ax×bx + ay×by + az×bz

#### **Length Node**
- **Purpose**: Calculate vector magnitude
- **Ports**:
  - `a` (input): Vector3 object
  - `out` (output): Vector length
- **Formula**: ||a|| = √(ax² + ay² + az²)

## Creating Equations

### Simple Math Example: (5 + 3) × 2

1. **Create the nodes**:
   - 1 Start node
   - 3 Number nodes (values: 5, 3, 2)
   - 1 Add node
   - 1 Multiply node
   - 1 Print node

2. **Set up the values**:
   - Select each Number node
   - Set their `num` values to 5, 3, and 2

3. **Connect the data flow**:
   - Number(5) `v` → Add `a`
   - Number(3) `v` → Add `b`
   - Add `out` → Multiply `a`
   - Number(2) `v` → Multiply `b`
   - Multiply `out` → Print `in`

4. **Connect the execution flow**:
   - Start `exec` → Add `exec`
   - Add `exec` → Multiply `exec`
   - Multiply `exec` → Print `exec`

5. **Run the equation**:
   - Click "Run Graph (▶)"
   - Result: "Print: 16"

### Vector Math Example: Dot Product

1. **Create two vectors**:
   - Vec3(1, 2, 3)
   - Vec3(4, 5, 6)

2. **Calculate dot product**:
   - Connect both Vec3 outputs to Dot Product inputs
   - Connect Dot Product output to Print

3. **Expected result**: 32 (1×4 + 2×5 + 3×6)

## User Interface

### Canvas Area (Center)
- **Pan**: Hold `Space` + drag
- **Zoom**: Mouse wheel
- **Select**: Click on nodes
- **Multi-select**: `Shift` + click
- **Delete**: Select nodes and press `Delete`

### Tool Palette (Left Panel)
Contains all available node types:
- **Start**: Execution entry point
- **Add**: Addition operation
- **Multiply**: Multiplication operation
- **Vec3**: 3D vector
- **Number**: Constant number value
- **Dot**: Vector dot product
- **Length**: Vector magnitude
- **Print**: Display results

### Properties Panel (Right Panel)
Shows details for the selected node:
- **Inputs**: Editable values (when not connected)
- **Outputs**: Current values and results
- **Ports**: Summary of all connections

### Header Controls
- **Shape tools**: Rectangle, Circle, etc. (for drawing)
- **Select/Move (V)**: Default selection tool
- **Group (G)**: Group selected nodes
- **Ungroup**: Ungroup selected group
- **Run Graph (▶)**: Execute the current graph

## Development

### Project Structure
```
dez-graph/
├── js/
│   ├── main.js          # Application entry point
│   ├── models.js        # Data classes (Node, Port, Edge, Graph)
│   ├── logic.js         # Logic system and node implementations
│   ├── renderer.js      # Canvas rendering
│   ├── editor.js        # User interface and interactions
│   ├── shapes.js        # Visual node definitions
│   └── utils.js         # Utility functions
├── css/
│   └── style.css        # Application styles
├── index.html           # Main HTML file
├── server.js            # Development server
└── package.json         # Node.js dependencies
```

### Running in Development Mode
```bash
npm run dev
```
This starts nodemon which automatically restarts the server when you make changes to `.js`, `.html`, or `.css` files.

### Adding New Node Types

1. **Define the logic** in `logic.js`:
```javascript
Logic.define('logic:mynode', (node, inputs, { log }) => {
  const result = inputs.a + inputs.b;
  return { output: result };
});
```

2. **Create the node factory** in `logic.js`:
```javascript
else if (kind === 'logic:mynode') {
  n.ports = [
    logicPorts.in('a', 'number'),
    logicPorts.in('b', 'number'),
    logicPorts.out('output', 'number')
  ];
  n.ports.forEach(p => p.nodeId = n.id);
}
```

3. **Add visual styling** in `shapes.js`:
```javascript
ShapeRegistry.define('logic:mynode', {
  draw(ctx, n) {
    ctx.fillStyle = '#2a4a3a';
    ctx.strokeStyle = '#4a7a5a';
    roundRectPath(ctx, n.x, n.y, n.w, n.h, 10);
    ctx.fill();
    ctx.stroke();
    drawLabel(ctx, { ...n, label: 'My Node' });
  }
});
```

4. **Add to palette** in `index.html`:
```html
<div class="tool" data-shape="logic:mynode">🔧 My Node</div>
```

## Examples

### Example 1: Quadratic Formula Helper
Calculate parts of the quadratic formula: b² - 4ac

**Nodes needed**:
- 3 Number nodes (for a, b, c values)
- 1 Multiply node (for b²)
- 1 Multiply node (for 4ac)
- 1 Add node (actually subtract: b² + (-4ac))
- 1 Print node

### Example 2: Distance Between 3D Points
Calculate distance between two points in 3D space

**Nodes needed**:
- 2 Vec3 nodes (for point coordinates)
- Math nodes to calculate (p2 - p1)
- Length node to get the distance
- Print node for result

### Example 3: Physics Calculation
Calculate kinetic energy: KE = ½mv²

**Nodes needed**:
- Number nodes for mass (m) and velocity (v)
- Multiply node for v²
- Number node for ½ (0.5)
- Multiply nodes for the formula
- Print node for result

## Tips and Best Practices

1. **Start Simple**: Begin with basic math operations before complex equations
2. **Use Print Nodes**: Add Print nodes to debug intermediate results
3. **Label Your Work**: Group related nodes to keep things organized
4. **Check Connections**: Ensure both execution flow and data flow are properly connected
5. **Test Incrementally**: Build and test small parts before creating complex graphs

## Keyboard Shortcuts

- `V`: Switch to Select/Move tool
- `G`: Group selected nodes
- `Space` + drag: Pan the canvas
- `Shift` + click: Multi-select nodes
- `Delete`: Delete selected nodes
- `Esc`: Cancel current connector operation

## Troubleshooting

### "Print: undefined" appears
- **Cause**: Missing data connection or incorrect execution order
- **Solution**: Ensure both execution flow and data flow are connected properly

### Node shows "(run to update)"
- **Cause**: Node hasn't been executed yet
- **Solution**: Run the graph or check if execution flow reaches the node

### Cannot edit connected values
- **Cause**: Input is connected to another node's output
- **Solution**: This is normal - disconnect the input to edit manually

### Changes not appearing in browser
- **Cause**: Browser cache or server not restarting
- **Solution**: Refresh the browser (F5) after making changes

---

*Happy visual programming! 🚀*
