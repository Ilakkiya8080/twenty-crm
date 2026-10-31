"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WorkspaceMemberCreateOnePreQueryHook", {
    enumerable: true,
    get: function() {
        return WorkspaceMemberCreateOnePreQueryHook;
    }
});
const _utils = require("twenty-shared/utils");
const _workspacequeryhookdecorator = require("../../../engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator");
const _workspaceexception = require("../../../engine/core-modules/workspace/workspace.exception");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let WorkspaceMemberCreateOnePreQueryHook = class WorkspaceMemberCreateOnePreQueryHook {
    async execute(authContext, objectName, payload) {
        const workspace = authContext.workspace;
        (0, _utils.assertIsDefinedOrThrow)(workspace, _workspaceexception.WorkspaceNotFoundDefaultError);
        return payload;
    }
    constructor(){}
};
WorkspaceMemberCreateOnePreQueryHook = _ts_decorate([
    (0, _workspacequeryhookdecorator.WorkspaceQueryHook)(`workspaceMember.createOne`),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [])
], WorkspaceMemberCreateOnePreQueryHook);
