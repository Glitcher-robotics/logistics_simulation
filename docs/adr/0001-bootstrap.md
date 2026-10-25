# ADR 0001: Local 3D application with a pure simulation core

- Status: accepted for H0.
- Context: a new empty repository, no private CAD input, and an explicit need for a spatial logistics simulator.
- Decision: use React/Three.js/TypeScript in one Vite project; pure event-based core; versioned JSON scenarios; procedural warehouse assets; local execution and CI.
- Consequences: one language for headless checks and rendering integration; no workstation-specific simulator installation or external asset dependency. Three.js supplies rendering, not logistics, collision arbitration, robot kinematics, or physics; those need explicit domain implementations.
- H0 scope: a single AMR carrying real scene pallets along a validated graph. Multiple robots, charging and CAD import remain tracked acceptance work.
- Revisit when: operational requirements need a rigid-body engine, sensors/ROS integration, proprietary robot models, or significantly larger simulations. Keep the scenario and report contracts portable.
