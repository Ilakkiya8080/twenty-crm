"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WorkspaceMemberDeleteOnePostQueryHook", {
    enumerable: true,
    get: function() {
        return WorkspaceMemberDeleteOnePostQueryHook;
    }
});
const _typeorm = require("@nestjs/typeorm");
const _utils = require("twenty-shared/utils");
const _typeorm1 = require("typeorm");
const _workspacequeryhookdecorator = require("../../../engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator");
const _workspacequeryhooktype = require("../../../engine/api/graphql/workspace-query-runner/workspace-query-hook/types/workspace-query-hook.type");
const _recordshareownershiptransferservice = require("../../../engine/core-modules/record-share/services/record-share-ownership-transfer.service");
const _userworkspaceentity = require("../../../engine/core-modules/user-workspace/user-workspace.entity");
const _userworkspaceservice = require("../../../engine/core-modules/user-workspace/user-workspace.service");
const _workspaceexception = require("../../../engine/core-modules/workspace/workspace.exception");
const _connectedaccountownershiptransferservice = require("../../../engine/metadata-modules/connected-account/services/connected-account-ownership-transfer.service");
const _agenthistoryrepository = require("../../../engine/metadata-modules/ai/ai-history/repositories/agent-history-repository");
const _injectagenthistoryrepositorydecorator = require("../../../engine/metadata-modules/ai/ai-history/repositories/inject-agent-history-repository.decorator");
const _permissionsexception = require("../../../engine/metadata-modules/permissions/permissions.exception");
const _workspaceormmanager = require("../../../engine/twenty-orm/workspace-orm.manager");
const _workspacecacheservice = require("../../../engine/workspace-cache/services/workspace-cache.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let WorkspaceMemberDeleteOnePostQueryHook = class WorkspaceMemberDeleteOnePostQueryHook {
    async execute(authContext, _objectName, payload) {
        if (!payload || payload.length === 0) {
            return;
        }
        const deletedWorkspaceMember = payload[0];
        const targettedWorkspaceMemberId = deletedWorkspaceMember.id;
        const workspace = authContext.workspace;
        (0, _utils.assertIsDefinedOrThrow)(workspace, _workspaceexception.WorkspaceNotFoundDefaultError);
        const workspaceMember = await this.workspaceOrmManager.executeInWorkspaceContext(async ()=>{
            const workspaceMemberRepository = this.workspaceOrmManager.getRepository('workspaceMember', {
                shouldBypassPermissionChecks: true
            });
            return workspaceMemberRepository.findOne({
                where: {
                    id: targettedWorkspaceMemberId
                },
                withDeleted: true
            });
        }, authContext);
        if (!(0, _utils.isDefined)(workspaceMember)) {
            throw new _permissionsexception.PermissionsException('Workspace member not found', _permissionsexception.PermissionsExceptionCode.WORKSPACE_MEMBER_NOT_FOUND);
        }
        const userWorkspace = await this.userWorkspaceRepository.findOne({
            where: {
                workspaceId: workspace.id,
                userId: workspaceMember.userId
            }
        });
        if (!(0, _utils.isDefined)(userWorkspace)) {
            throw new _permissionsexception.PermissionsException('User workspace not found', _permissionsexception.PermissionsExceptionCode.USER_WORKSPACE_NOT_FOUND);
        }
        await this.connectedAccountOwnershipTransferService.transferConnectedAccountsOwnershipToCustodian({
            removedUserWorkspace: userWorkspace,
            actingUserWorkspaceId: 'userWorkspaceId' in authContext ? authContext.userWorkspaceId : undefined
        });
        await this.recordShareOwnershipTransferService.transferRecordSharesToCustodian({
            removedUserWorkspace: userWorkspace,
            removedWorkspaceMemberId: workspaceMember.id,
            actingUserWorkspaceId: 'userWorkspaceId' in authContext ? authContext.userWorkspaceId : undefined
        });
        await this.userWorkspaceService.deleteUserWorkspace({
            userWorkspaceId: userWorkspace.id,
            workspaceId: workspace.id
        });
        await this.workspaceCacheService.invalidateAndRecompute(workspace.id, [
            'flatWorkspaceMemberMaps'
        ]);
        // After the membership is gone, so a failed removal keeps the history and racing threads are cleaned too
        await this.agentChatThreadRepository.delete(workspace.id, {
            workspaceMemberId: workspaceMember.id
        });
    }
    constructor(workspaceOrmManager, userWorkspaceRepository, userWorkspaceService, connectedAccountOwnershipTransferService, recordShareOwnershipTransferService, agentChatThreadRepository, workspaceCacheService){
        this.workspaceOrmManager = workspaceOrmManager;
        this.userWorkspaceRepository = userWorkspaceRepository;
        this.userWorkspaceService = userWorkspaceService;
        this.connectedAccountOwnershipTransferService = connectedAccountOwnershipTransferService;
        this.recordShareOwnershipTransferService = recordShareOwnershipTransferService;
        this.agentChatThreadRepository = agentChatThreadRepository;
        this.workspaceCacheService = workspaceCacheService;
    }
};
WorkspaceMemberDeleteOnePostQueryHook = _ts_decorate([
    (0, _workspacequeryhookdecorator.WorkspaceQueryHook)({
        key: `workspaceMember.deleteOne`,
        type: _workspacequeryhooktype.WorkspaceQueryHookType.POST_HOOK
    }),
    _ts_param(1, (0, _typeorm.InjectRepository)(_userworkspaceentity.UserWorkspaceEntity)),
    _ts_param(5, (0, _injectagenthistoryrepositorydecorator.InjectAgentHistoryRepository)('agentChatThread')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _workspaceormmanager.WorkspaceOrmManager === "undefined" ? Object : _workspaceormmanager.WorkspaceOrmManager,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _userworkspaceservice.UserWorkspaceService === "undefined" ? Object : _userworkspaceservice.UserWorkspaceService,
        typeof _connectedaccountownershiptransferservice.ConnectedAccountOwnershipTransferService === "undefined" ? Object : _connectedaccountownershiptransferservice.ConnectedAccountOwnershipTransferService,
        typeof _recordshareownershiptransferservice.RecordShareOwnershipTransferService === "undefined" ? Object : _recordshareownershiptransferservice.RecordShareOwnershipTransferService,
        typeof _agenthistoryrepository.AgentHistoryRepository === "undefined" ? Object : _agenthistoryrepository.AgentHistoryRepository,
        typeof _workspacecacheservice.WorkspaceCacheService === "undefined" ? Object : _workspacecacheservice.WorkspaceCacheService
    ])
], WorkspaceMemberDeleteOnePostQueryHook);

//# sourceMappingURL=workspace-member-delete-one.post-query.hook.js.map