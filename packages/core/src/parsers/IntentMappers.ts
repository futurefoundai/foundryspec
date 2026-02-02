/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * © 2026 FutureFoundAI. All rights reserved.
 */

/**
 * Base Intent Mapper representing the 'yy' context for Jison parsers.
 * 
 * IMPORTANT: We use arrow functions for all methods to ensure they are 
 * 'own' properties of the instance. Jison's generated parsers often
 * perform a 'hasOwnProperty' check when copying shared state.
 */
export abstract class BaseMapper {
    public nodes: { id?: string; type: string; [key: string]: any }[] = [];
    public edges: { from: string; to: string; [key: string]: any }[] = [];
    public subgraphs: { id: string; title: string; nodes?: any[] }[] = [];
    public accTitle: string = '';
    public accDescription: string = '';
    public diagramTitle: string = '';

    public setAccTitle = (t: string) => { this.accTitle = t; };
    public setAccDescription = (d: string) => { this.accDescription = d; };
    public setDiagramTitle = (t: string) => { this.diagramTitle = t; };
    public cleanupLabel = (s: string) => s?.replace(/^[:\s]+/, '').trim();
    public parseError = (err: string) => { throw new Error(err); };
    public getLogger = () => {
        return {
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            trace: () => {}
        };
    };
}

export class FlowchartMapper extends BaseMapper {
    public directions = { TB: 0, BT: 1, LR: 2, RL: 3, TD: 4 };
    public direction: string = 'TD';

    public setDirection = (d: string) => { this.direction = d; };
    public getDirection = () => this.direction;
    
    public addVertex = (id: string, text: any, type: string, style: any, classes: any, dir: any, props: any, shapeData: any) => {
        this.nodes.push({ 
            id: id || (text?.text), 
            text: text?.text || id, 
            type: type || 'default',
            shapeData 
        });
    }

    public addLink = (start: string, end: string, text: any) => {
        this.edges.push({ from: start, to: end, text: text?.text });
    }

    public addSubGraph = (id: string, list: any[], title: string) => {
        const subId = id || `sub_${this.subgraphs.length}`;
        this.subgraphs.push({ id: subId, title, nodes: list });
        return subId;
    }

    public firstGraph = () => true;
    public lex = { firstGraph: () => true };
    public destructLink = () => ({ type: 'arrow', stroke: 'normal', length: 1 });
    public updateLink = () => {};
    public updateLinkInterpolate = () => {};
    public setCssStyle = () => {};
    public defineClass = () => {};
    public setClass = () => {};
    public setClickEvent = () => {};
    public setTooltip = () => {};
    public setLink = () => {};
}

export class SequenceMapper extends BaseMapper {
    public LINETYPE = {
        SOLID: 0, DOTTED: 1, NOTE: 2, SOLID_CROSS: 3, DOTTED_CROSS: 4,
        SOLID_OPEN: 5, DOTTED_OPEN: 6, LOOP_START: 10, LOOP_END: 11,
        ALT_START: 12, ALT_ELSE: 13, ALT_END: 14, OPT_START: 15, OPT_END: 16,
        PAR_START: 17, PAR_AND: 18, PAR_END: 19, RECT_START: 20, RECT_END: 21,
        ACTIVE_START: 22, ACTIVE_END: 23, AUTONUMBER: 27
    };
    public PLACEMENT = { LEFTOF: 0, RIGHTOF: 1, OVER: 2 };
    public sequenceData: any[] = [];

    public addActor = (id: string, name: string, description: string, _type: string) => {
        this.nodes.push({ id: id || name, name: name || id, type: 'actor', description });
    };

    public addMessage = (from: string, to: string, msg: string, type: number) => {
        this.edges.push({ from, to, text: msg, type: String(type) });
    };

    public addNote = (actor: any, placement: any, msg: string) => {
        this.nodes.push({ type: 'note', actor, placement, text: msg });
    };

    public apply = (data: any) => {
        this.sequenceData = data;
    };

    public parseMessage = (s: string) => s;
    public parseBoxData = (s: string) => s;
}

export class ClassMapper extends BaseMapper {
    public relationType = { AGGREGATION: 0, EXTENSION: 1, COMPOSITION: 2, DEPENDENCY: 3, ARROW: 4, LINE: 5, DOTTED_LINE: 6 };
    public lineType = { LINE: 0, DOTTED: 1 };

    public addClass = (id: string) => {
        this.nodes.push({ id, type: 'class' });
    };

    public addRelation = (item1: any, item2: any, relation: any) => {
        let from, to, rel = relation;
        
        // Handle case where item1 is a combined relation object
        if (item1 && typeof item1 === 'object' && item1.id1 && item1.id2) {
            from = item1.id1;
            to = item1.id2;
            rel = item1.relation || relation;
        } else {
            from = item1?.id || item1;
            to = item2?.id || item2;
        }

        if (from && to) {
            this.edges.push({ from, to, relation: rel });
        }
    };

    public getClass = (id: string) => ({ id, type: 'class' });
    public addMembers = () => {};
}

export class StateMapper extends BaseMapper {
    public addState = (id: string, type: string, description: string, doc: any) => {
        const stateId = id === '[*]' ? 'START_NODE' : id;
        this.nodes.push({ id: stateId, type: type || 'default', description, doc });
    };

    public addRelation = (item1: any, item2: any, description: string) => {
        const from = (item1?.id || item1) === '[*]' ? 'START_NODE' : (item1?.id || item1);
        const to = (item2?.id || item2) === '[*]' ? 'START_NODE' : (item2?.id || item2);
        if (from && to) {
            this.edges.push({ from, to, text: description });
        }
    };

    public trimColon = (str: string) => str?.replace(/^:/, '').trim();
    public getDividerId = () => `divider_${Math.random().toString(36).substr(2, 9)}`;
    public setRootDoc = (d: any) => { (this as any).rootDoc = d; };
}

export class ERMapper extends BaseMapper {
    public Cardinality = { ONLY_ONE: '1', ZERO_OR_ONE: '0..1', ZERO_OR_MORE: '0..n', ONE_OR_MORE: '1..n', MD_PARENT: 'MD_PARENT' };
    public Identification = { NON_IDENTIFYING: 'NON_IDENTIFYING', IDENTIFYING: 'IDENTIFYING' };

    public addEntity = (name: string) => {
        this.nodes.push({ id: name, type: 'entity' });
    };

    public addRelationship = (ent1: string, role1: string, ent2: string, role2: string, relSpec: any) => {
        this.edges.push({ 
            from: ent1, 
            to: ent2, 
            role1, 
            role2, 
            relation: relSpec 
        });
    };

    public addAttributes = () => {};
}

export class MindmapMapper extends BaseMapper {
    public nodeType = { DEFAULT: 0, ROUNDED: 1 };
    public mindmapMappings: Record<string, string> = {};

    public addNode = (level: number, id: string, descr: string, _type: any) => {
        const nodeId = id;
        const text = descr || id;
        this.nodes.push({ 
            id: nodeId, 
            text: text, 
            type: 'mindmap_node',
            level 
        });
        if (nodeId && text) {
            this.mindmapMappings[text] = nodeId;
        }
    };

    public getMindmap = () => ({ root: { id: 'root' } });
    public getType = () => 'default';
}

export class RequirementMapper extends BaseMapper {
    public currentRequirement: any = {};
    public currentElement: any = {};
    
    public RequirementType = {
        REQUIREMENT: 'Requirement',
        FUNCTIONAL_REQUIREMENT: 'Functional', INTERFACE_REQUIREMENT: 'Interface',
        PERFORMANCE_REQUIREMENT: 'Performance', PHYSICAL_REQUIREMENT: 'Physical',
        DESIGN_CONSTRAINT: 'Design Constraint'
    };
    public RiskLevel = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };
    public VerifyType = { TEST: 'Test' };
    public Relationships = {
        CONTAINS: 'contains', COPIES: 'copies', DERIVES: 'derives',
        REFINES: 'refines', SATISFIES: 'satisfies', TRACES: 'traces', VERIFIES: 'verifies'
    };

    public setNewReqId = (id: string) => { this.currentRequirement.id = id; };
    public setNewReqText = (t: string) => { this.currentRequirement.text = t; };
    public setNewReqRisk = (r: string) => { this.currentRequirement.risk = r; };
    public setNewReqVerifyMethod = (m: string) => { this.currentRequirement.verifyMethod = m; };

    public addRequirement = (name: string, type: string) => {
        const id = this.currentRequirement.id || name;
        this.nodes.push({ id, type: 'requirement', name, reqType: type, ...this.currentRequirement });
        this.currentRequirement = {};
    };

    public setNewElementType = (t: string) => { this.currentElement.type = t; };
    public setNewElementDocRef = (r: string) => { this.currentElement.docRef = r; };

    public addElement = (name: string) => {
        this.nodes.push({ id: name, type: 'element', ...this.currentElement });
        this.currentElement = {};
    };

    public addRelationship = (src: string, dst: string, type: string) => {
        this.edges.push({ from: src, to: dst, type });
    };
}
